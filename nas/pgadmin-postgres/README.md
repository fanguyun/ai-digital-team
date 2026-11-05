# PostgreSQL 18 + pgAdmin 4 on 绿联 NAS（UGOS）

与本地开发库版本一致（`postgres:18-alpine`），配合 `yarn db:push` 做异地副本。

## 部署环境已知约束（都踩过，别再试）

| 现象 | 根因 | 对策 |
| --- | --- | --- |
| `docker ps` 的 PORTS 列为空，容器却 healthy；局域网 `Connection refused` | **宿主机 127.0.0.1:5432 有 UGOS 自带的 PostgreSQL**，Docker 绑 `0.0.0.0:5432` 冲突后**静默不发布**（不报错） | 端口绑具体 IP：`192.168.31.150:5432:5432` |
| 改 5051 仍 `address already in use` | 迅雷 `xunlei-pan-cli` 同时占用 5050 和 5051（回环） | pgAdmin 用 **5080** |
| 容器重建后数据"消失" | PG18 镜像 `PGDATA=/var/lib/postgresql/18/docker`，挂载点必须是 `/var/lib/postgresql`；仍挂 `.../data` 会让数据落在容器可写层 | 见下方 volumes |
| `FATAL: role "xxx" is not permitted to log in` | `CREATE ROLE` 默认 `NOLOGIN` | 必须写 `CREATE ROLE xxx LOGIN PASSWORD ...` |
| pgAdmin `Failed to create ... /var/lib/pgadmin/sessions` | 进程 uid 5050，数据目录属主是 root | `pgadmin-init` 一次性 chown |
| 访问 `192.100.x.x:5080` 不通 | 那是 libvirt 的 `virbr0/1/2` 虚拟网桥 | 访问 `192.168.31.150`（bridge0） |

## 从 PG17 切到 18（**必须重新初始化数据目录**）

PG18 的镜像布局与 17 不兼容，旧数据目录无法被 18 复用（`PG_VERSION` 校验会直接拒绝启动）。NAS 上目前只是空库，重建最干净：

```bash
cd /volume1/docker/postgres

# 1) 停库（pgadmin 可以先留着不动）
sudo docker compose stop postgres

# 2) 旧 17 数据目录改名留底，不要直接删
sudo mv postgres/data "postgres/data-pg17-$(date +%F)"

# 3) 建全新的空目录
sudo mkdir -p postgres/data

# 4) 修改 docker-compose.yml 两处：
#      image: postgres:18-alpine
#      - ./postgres/data:/var/lib/postgresql        ← 原来是 /var/lib/postgresql/data

# 5) 启动（配置变了会自动重建容器）
sudo docker compose up -d postgres

# 6) 等初始化完成（首次会 initdb，约 10 秒）
sudo docker logs -f postgres
```

## 重建角色和库（新目录是空的）

```bash
# 取 NAS 上的超级用户名
SU=$(sudo docker exec postgres sh -c 'printf %s "$POSTGRES_USER"')

sudo docker exec -i postgres psql -U "$SU" -d postgres <<'SQL'
-- LOGIN 不能漏，漏了就是 Prisma 的 P1010
CREATE ROLE personal_digital_team LOGIN PASSWORD '换成强密码';
CREATE DATABASE personal_digital_team      OWNER personal_digital_team;
CREATE DATABASE personal_digital_team_test OWNER personal_digital_team;
SQL

# 确认：Attributes 列不应出现 Cannot login
sudo docker exec -i postgres psql -U "$SU" -d postgres -c '\du'
sudo docker exec -i postgres psql -U "$SU" -d postgres -c '\l' | grep personal
```

## 验证端口真的发布了

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep postgres
# 必须有：192.168.31.150:5432->5432/tcp

sudo docker port postgres
# 5432/tcp -> 192.168.31.150:5432

t() { timeout 3 bash -c ":</dev/tcp/$1/$2" 2>/dev/null && echo "$1:$2 OPEN" || echo "$1:$2 CLOSED"; }
t 127.0.0.1 5432        # 这个是 UGOS 原生库，不是你的容器
t 192.168.31.150 5432   # 这个才是你的容器
```

## 和本地同步

```bash
# 本地（Mac）
cp scripts/db-sync.env.example scripts/db-sync.env   # 填 NAS_SSH
yarn db:sync-status
yarn db:push
```

两边都是 PG18 之后，`pg_dump` 不再有跨版本还原风险（脚本仍用 `--format=plain`，跨版本也兼容）。

## pgAdmin 连接

浏览器 `http://192.168.31.150:5080`，登录后 `Add New Server`：

| 字段 | 值 |
| --- | --- |
| Host | `postgres`（容器网络内的服务名） |
| Port | `5432` |
| Maintenance database | `personal_digital_team` |
| Username / Password | `personal_digital_team` / 上面设置的密码 |

不要填 `127.0.0.1` —— 那是宿主机的 UGOS 原生库。

## 备份

```bash
# 逻辑备份
sudo docker exec -t postgres pg_dumpall -U "$SU" > backup-$(date +%F).sql

# 目录备份：PG18 的数据实际在 postgres/data/18/docker 下
sudo tar czf pgstack-$(date +%F).tgz postgres/data/18 pgadmin/data docker-compose.yml
```

## 回滚到 PG17

```bash
sudo docker compose stop postgres
sudo mv postgres/data postgres/data-pg18-attempt
sudo mv postgres/data-pg17-YYYY-MM-DD postgres/data
# compose 改回 image: postgres:17 且挂载 /var/lib/postgresql/data
sudo docker compose up -d postgres
```

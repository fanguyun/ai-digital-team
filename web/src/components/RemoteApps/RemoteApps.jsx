import { useState } from 'react'

import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Typography,
  Upload,
} from 'antd'
import { Menu, Pencil, Plus, Trash2, Upload as UploadIcon } from 'lucide-react'

import { useMutation, useQuery } from '@cedarjs/web'

import { resizeImageToDataUrl } from 'src/components/RemoteApps/iconUpload'
import {
  displayHost,
  hashColor,
  initialFor,
  isImageIcon,
  isValidUrl,
  normalizeUrlInput,
} from 'src/components/RemoteApps/remoteAppsModel'

const APPS_QUERY = gql`
  query RemoteApps {
    remoteApps {
      id
      name
      url
      icon
      createdAt
      updatedAt
    }
  }
`

const CREATE_APP = gql`
  mutation CreateRemoteApp($input: CreateRemoteAppInput!) {
    createRemoteApp(input: $input) {
      id
    }
  }
`

const UPDATE_APP = gql`
  mutation UpdateRemoteApp($id: ID!, $input: UpdateRemoteAppInput!) {
    updateRemoteApp(id: $id, input: $input) {
      id
    }
  }
`

const DELETE_APP = gql`
  mutation DeleteRemoteApp($id: ID!) {
    deleteRemoteApp(id: $id) {
      id
    }
  }
`

const RemoteAppIcon = ({ icon, name }) => {
  const [brokenImage, setBrokenImage] = useState(false)

  if (isImageIcon(icon) && !brokenImage) {
    return (
      <img
        className="remote-app-icon"
        src={icon}
        alt=""
        onError={() => setBrokenImage(true)}
      />
    )
  }

  return (
    <span
      className="remote-app-icon is-text"
      style={{ background: hashColor(name) }}
      aria-hidden="true"
    >
      {icon && !isImageIcon(icon) ? icon : initialFor(name)}
    </span>
  )
}

const RemoteApps = ({ onOpenSidebar }) => {
  const { data, loading, error, refetch } = useQuery(APPS_QUERY, {
    fetchPolicy: 'cache-and-network',
  })
  const [createApp] = useMutation(CREATE_APP)
  const [updateApp] = useMutation(UPDATE_APP)
  const [deleteApp] = useMutation(DELETE_APP)

  const [form] = Form.useForm()
  const iconValue = Form.useWatch('icon', form)
  const nameValue = Form.useWatch('name', form)
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  const apps = data?.remoteApps || []

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({ name: '', url: '', icon: '' })
    setModalOpen(true)
  }

  const openEdit = (app) => {
    setEditing(app)
    form.setFieldsValue({ name: app.name, url: app.url, icon: app.icon })
    setModalOpen(true)
  }

  const handleIconFile = async (file) => {
    setNotice(null)
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      form.setFieldValue('icon', dataUrl)
    } catch (uploadError) {
      setNotice({ type: 'error', message: uploadError.message })
    }
    // 交给本地处理，不触发 antd 的自动上传
    return Upload.LIST_IGNORE
  }

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    const input = {
      name: values.name.trim(),
      url: normalizeUrlInput(values.url),
      icon: (values.icon || '').trim(),
    }

    setSaving(true)
    setNotice(null)
    try {
      if (editing) {
        await updateApp({ variables: { id: editing.id, input } })
        setNotice({ type: 'success', message: `已更新「${input.name}」` })
      } else {
        await createApp({ variables: { input } })
        setNotice({ type: 'success', message: `已添加「${input.name}」` })
      }
      setModalOpen(false)
      await refetch()
    } catch (submitError) {
      setNotice({ type: 'error', message: submitError.message })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (app) => {
    setNotice(null)
    try {
      await deleteApp({ variables: { id: app.id } })
      setNotice({ type: 'success', message: `已删除「${app.name}」` })
      await refetch()
    } catch (deleteError) {
      setNotice({ type: 'error', message: deleteError.message })
    }
  }

  return (
    <section className="workspace-view remote-apps">
      <div className="page-intro">
        <button
          type="button"
          className="mobile-menu"
          onClick={onOpenSidebar}
          aria-label="打开导航"
        >
          <Menu size={20} />
        </button>
        <div>
          <div className="section-kicker">APP CENTER</div>
          <h1>应用中心</h1>
          <p>管理异地组网里的服务入口，点击卡片在新窗口打开。</p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          style={{ marginLeft: 'auto' }}
          onClick={openCreate}
        >
          新建应用
        </Button>
      </div>

      {notice && (
        <Alert
          style={{ margin: '14px 0' }}
          type={notice.type}
          message={notice.message}
          showIcon
          closable
          onClose={() => setNotice(null)}
        />
      )}
      {loading && !apps.length && (
        <Typography.Text>正在读取应用列表…</Typography.Text>
      )}
      {error && !apps.length && (
        <Alert type="error" showIcon message="暂时无法读取应用列表。" />
      )}

      <div className="remote-apps-grid">
        {apps.map((app) => (
          <Card key={app.id} className="remote-app-card" hoverable>
            <a
              className="remote-app-link"
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <RemoteAppIcon icon={app.icon} name={app.name} />
              <span className="remote-app-meta">
                <strong>{app.name}</strong>
                <span>{displayHost(app.url)}</span>
              </span>
            </a>
            <Flex gap={4} className="remote-app-actions">
              <Button
                size="small"
                type="text"
                icon={<Pencil size={14} />}
                aria-label={`编辑 ${app.name}`}
                onClick={() => openEdit(app)}
              />
              <Popconfirm
                title="删除这个应用？"
                description="删除后不可恢复。"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => remove(app)}
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<Trash2 size={14} />}
                  aria-label={`删除 ${app.name}`}
                />
              </Popconfirm>
            </Flex>
          </Card>
        ))}
      </div>

      {!loading && !apps.length && (
        <Typography.Text type="secondary">
          还没有应用，点击右上角「新建应用」添加第一个入口。
        </Typography.Text>
      )}

      <Modal
        title={editing ? '编辑应用' : '新建应用'}
        open={modalOpen}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        onOk={() => void submit()}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="名称"
            rules={[
              { required: true, message: '请填写应用名称' },
              { max: 120, message: '名称不能超过 120 个字符' },
            ]}
          >
            <Input placeholder="例如：pgAdmin" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="url"
            label="链接"
            rules={[
              { required: true, message: '请填写应用链接' },
              {
                validator: async (_, value) => {
                  if (!value || isValidUrl(value)) return
                  throw new Error('请填写 http/https 链接')
                },
              },
            ]}
          >
            <Input
              placeholder="192.168.31.150:5080 或 https://example.com"
              autoComplete="off"
            />
          </Form.Item>
          <Form.Item
            label="图标"
            extra="支持上传图片、图片链接或 emoji；留空则使用名称首字"
          >
            <Flex vertical gap={8}>
              <Flex gap={8} align="center" wrap>
                <RemoteAppIcon icon={iconValue} name={nameValue} />
                <Upload
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  showUploadList={false}
                  beforeUpload={handleIconFile}
                >
                  <Button icon={<UploadIcon size={14} />}>上传图片</Button>
                </Upload>
                <Button
                  type="text"
                  disabled={!iconValue}
                  onClick={() => form.setFieldValue('icon', '')}
                >
                  清除
                </Button>
              </Flex>
              <Form.Item name="icon" noStyle>
                <Input
                  placeholder="也可直接粘贴 emoji / 文字 / 图片 URL"
                  autoComplete="off"
                />
              </Form.Item>
            </Flex>
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}

export default RemoteApps

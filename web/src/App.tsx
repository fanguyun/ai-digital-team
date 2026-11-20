import type { ReactNode } from 'react'

import { ApolloLink } from '@apollo/client'
import dayjs from 'dayjs'

import 'dayjs/locale/zh-cn'
import { FatalErrorBoundary, RedwoodProvider } from '@cedarjs/web'
import {
  RedwoodApolloProvider,
  type GraphQLClientConfigProp,
} from '@cedarjs/web/apollo'

import { AuthProvider } from 'src/auth'
import GlobalLoadingBar from 'src/components/GlobalLoadingBar/GlobalLoadingBar'
import { requestLoadingLink } from 'src/lib/requestLoading'
import FatalErrorPage from 'src/pages/FatalErrorPage'
import { ThemeProvider } from 'src/theme'

import './index.css'

dayjs.locale('zh-cn')

// 把打点 link 放在最外层，所有查询/变更都会经过它；HttpLink 仍在最后
const graphQLClientConfig: GraphQLClientConfigProp = {
  link: (links) =>
    ApolloLink.from([requestLoadingLink, ...links.map(({ link }) => link)]),
}

interface AppProps {
  children?: ReactNode
}

const App = ({ children }: AppProps) => (
  <FatalErrorBoundary page={FatalErrorPage}>
    <ThemeProvider>
      <GlobalLoadingBar />
      <RedwoodProvider titleTemplate="%PageTitle | %AppTitle">
        <AuthProvider>
          <RedwoodApolloProvider graphQLClientConfig={graphQLClientConfig}>
            {children}
          </RedwoodApolloProvider>
        </AuthProvider>
      </RedwoodProvider>
    </ThemeProvider>
  </FatalErrorBoundary>
)

export default App

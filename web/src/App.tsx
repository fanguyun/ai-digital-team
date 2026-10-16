import type { ReactNode } from 'react'

import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { FatalErrorBoundary, RedwoodProvider } from '@cedarjs/web'
import { RedwoodApolloProvider } from '@cedarjs/web/apollo'

import { AuthProvider } from 'src/auth'
import FatalErrorPage from 'src/pages/FatalErrorPage'
import { ThemeProvider } from 'src/theme'

import './index.css'

dayjs.locale('zh-cn')

interface AppProps {
  children?: ReactNode
}

const App = ({ children }: AppProps) => (
  <FatalErrorBoundary page={FatalErrorPage}>
    <ThemeProvider>
      <RedwoodProvider titleTemplate="%PageTitle | %AppTitle">
        <AuthProvider>
          <RedwoodApolloProvider>{children}</RedwoodApolloProvider>
        </AuthProvider>
      </RedwoodProvider>
    </ThemeProvider>
  </FatalErrorBoundary>
)

export default App

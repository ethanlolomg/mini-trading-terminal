import { Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import NetworkPage from './pages/NetworkPage'
import TokenPage from './pages/TokenPage'

function App() {
  return (
    <>
      <Toaster position="top-center" />
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/networks/:networkId" element={<NetworkPage />} />
          <Route path="/networks/:networkId/tokens/:tokenId" element={<TokenPage />} />
        </Routes>
      </Layout>
    </>
  )
}

export default App
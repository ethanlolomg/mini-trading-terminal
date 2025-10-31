import { ReactNode, useEffect } from 'react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  useEffect(() => {
    // Load Geist Mono font
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)

    // Add font-family to body
    document.body.style.fontFamily = '"Geist Mono", monospace'

    return () => {
      document.head.removeChild(link)
    }
  }, [])

  return (
    <>
      {children}
    </>
  )
}
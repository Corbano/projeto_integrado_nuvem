import { useEffect } from 'react'

/** Define o título da aba como "{título} · Auto Center". */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Auto Center`
  }, [title])
}

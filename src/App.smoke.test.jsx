// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Verificare de fum: aplicația se montează și fiecare tab se randează fără erori
describe('App', () => {
  test('se montează și toate taburile se deschid', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<App />)
    })
    expect(container.textContent).toContain('Analizor & Tracker Pariuri')
    expect(container.textContent).toContain('Bancă')

    const clickTab = async (label) => {
      const btn = [...container.querySelectorAll('nav button')].find((b) => b.textContent.includes(label))
      expect(btn).toBeTruthy()
      await act(async () => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
    }

    await clickTab('Bilete Active')
    expect(container.textContent).toContain('Niciun bilet activ')

    await clickTab('Statistici')
    expect(container.textContent).toContain('Statistici Echipe')

    await clickTab('Istoric')
    expect(container.textContent).toContain('Profit net')
    expect(container.textContent).toContain('Defalcare Profit')

    await clickTab('Setări')
    expect(container.textContent).toContain('Bancă & Staking')

    await act(async () => {
      root.unmount()
    })
  })

  test('procesarea unui text simplu populează tabelul și sugestiile', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<App />)
    })

    const textarea = container.querySelector('textarea')
    const setNativeValue = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
      setter.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await act(async () => {
      setNativeValue(textarea, 'Mexic vs Canada | Under 2.5 Goluri | 1.80 | fotbal\nFranța vs Brazilia | GG NU | 1.90 | fotbal')
    })

    const processBtn = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Procesează'))
    await act(async () => {
      processBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('Mexic vs Canada')
    expect(container.textContent).toContain('selecții')
    // sugestiile au apărut (cel puțin „Pariuri Single")
    expect(container.textContent).toContain('Pariuri Single')

    await act(async () => {
      root.unmount()
    })
  })
})

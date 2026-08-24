import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Configuração obrigatória do pdfjs-dist (usado em rateioPdfParser.js pra
// ler os PDFs de rateio). Sem isso, a biblioteca reclama "No
// GlobalWorkerOptions.workerSrc specified" ao tentar abrir qualquer PDF.
// Importamos o worker com "?url" pra o Vite empacotar o arquivo junto com
// o build (em vez de buscar de um CDN externo, evitando desalinhamento de
// versão entre o pacote instalado e o worker baixado da internet).
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

import { useState, useEffect, useRef } from 'react'
import type { PreguntaIA } from '../types/ia'
import { enviarPreguntaIA } from '../services/iaService'

// Función para formatear texto con enlaces clickeables y mejor formato
const formatTextWithLinks = (text: string) => {
  // Primero, quitar corchetes alrededor de URLs
  const textWithoutBrackets = text.replace(/\[(https?:\/\/[^\]]+)\]/g, '$1')

  // Dividir el texto en líneas para mejor formato
  const lines = textWithoutBrackets.split('\n')

  return lines.map((line, lineIndex) => {
    // Detectar tablas (líneas con |)
    if (line.includes('|') && line.trim().length > 0) {
      return (
        <div key={lineIndex} className="mb-2">
          {formatTableLine(line)}
        </div>
      )
    }

    // Detectar títulos con paréntesis (como "Ingredientes (1 copa)")
    const isTitleWithParentheses = /^[A-Za-z\s]+\(\d+[^)]*\)/.test(line.trim())
    if (isTitleWithParentheses) {
      return (
        <div key={lineIndex} className="mb-3">
          <h4 className="text-lg font-semibold text-blue-700 mb-2">
            {formatLineWithLinks(line)}
          </h4>
        </div>
      )
    }

    // Detectar subtítulos (como "Pasos", "Tips de barra")
    const isSubtitle = /^[A-Za-z\s]+$/.test(line.trim()) && line.trim().length > 0 && lineIndex > 0
    if (isSubtitle && !line.includes('|') && !line.includes('•') && !line.includes('-')) {
      return (
        <div key={lineIndex} className="mb-2 mt-4">
          <h5 className="text-md font-semibold text-gray-700 mb-2">
            {formatLineWithLinks(line)}
          </h5>
        </div>
      )
    }

    // Detectar si la línea es una lista con viñetas
    const isBulletPoint = /^[\s]*[-*•]\s/.test(line)
    const isNumberedList = /^[\s]*\d+\.\s/.test(line)

    if (isBulletPoint || isNumberedList) {
      return (
        <div key={lineIndex} className="ml-4 mb-1 flex items-start">
          <span className="mr-2 text-blue-600 font-bold">
            {isBulletPoint ? '•' : line.match(/^\s*(\d+\.)/)?.[1]}
          </span>
          <span className="flex-1">
            {formatLineWithLinks(line.replace(/^[\s]*[-*•]\s|^[\s]*\d+\.\s/, ''))}
          </span>
        </div>
      )
    }

    // Si la línea está vacía, agregar espacio
    if (line.trim() === '') {
      return <div key={lineIndex} className="h-2"></div>
    }

    // Línea normal
    return (
      <div key={lineIndex} className="mb-2">
        {formatLineWithLinks(line)}
      </div>
    )
  })
}

// Función para formatear líneas de tabla
const formatTableLine = (line: string) => {
  const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0)

  if (cells.length === 0) return null

  // Si es una línea separadora (contiene solo guiones)
  if (cells.every(cell => /^-+$/.test(cell))) {
    return <div className="border-b border-gray-300 my-2"></div>
  }

  return (
    <div className="grid grid-cols-2 gap-4 py-2 border-b border-gray-100">
      {cells.map((cell, index) => (
        <div key={index} className="text-sm">
          {formatLineWithLinks(cell)}
        </div>
      ))}
    </div>
  )
}

// Función auxiliar para formatear enlaces en una línea
const formatLineWithLinks = (line: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = line.split(urlRegex)

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline font-medium"
        >
          {part}
        </a>
      )
    }
    return part
  })
}

function ContentIA() {
  const [input, setInput] = useState<string>('')
  const [conversacion, setConversacion] = useState<Array<{ tipo: 'pregunta' | 'respuesta', texto: string, id: string }>>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [respuestaStreaming, setRespuestaStreaming] = useState<string>('')
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll automático hacia abajo cuando cambia el contenido
  useEffect(() => {
    // Hacer scroll solo cuando se agrega una nueva respuesta completa
    if (conversacion.length > 0) {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 300) // Delay más largo para evitar titileo
      
      return () => clearTimeout(timer)
    }
  }, [conversacion.length]) // Solo cuando cambia la cantidad de mensajes

  // Detectar cuando se abre/cierra el teclado en mobile
  useEffect(() => {
    const handleResize = () => {
      const initialHeight = window.innerHeight
      const currentHeight = window.visualViewport?.height || window.innerHeight
      const heightDiff = initialHeight - currentHeight
      
      // Si la diferencia es significativa, probablemente se abrió el teclado
      setIsKeyboardOpen(heightDiff > 150)
      
      // Scroll al final cuando se abre el teclado
      if (heightDiff > 150) {
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 300)
      }
    }

    // Usar Visual Viewport API si está disponible (mejor para mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
    } else {
      window.addEventListener('resize', handleResize)
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      } else {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      console.log('⌨️ Enter presionado')
      if (input.trim() && !isLoading) {
        console.log('✅ Enviando por Enter')
        handleSubmit(e as any)
      } else {
        console.log('🚫 Enter bloqueado:', { hasInput: !!input.trim(), isLoading })
      }
    }
  }

  // Función para simular streaming
  const simularStreaming = (textoCompleto: string) => {
    setRespuestaStreaming('')
    let index = 0

    const interval = setInterval(() => {
      if (index < textoCompleto.length) {
        setRespuestaStreaming(textoCompleto.substring(0, index + 1))
        index++

        // Scroll automático solo al final del streaming
        if (index === textoCompleto.length - 1) {
          setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
      } else {
        clearInterval(interval)
      }
    }, 8) // 8ms entre caracteres para efecto de streaming más rápido

    return interval
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) {
      console.log('🚫 Envío bloqueado:', { hasInput: !!input.trim(), isLoading })
      return // Prevenir múltiples envíos
    }

    const preguntaTexto = input.trim()
    console.log('📝 Iniciando envío de pregunta:', preguntaTexto.substring(0, 50) + '...')

    // Agregar pregunta al historial
    const nuevaPregunta = {
      tipo: 'pregunta' as const,
      texto: preguntaTexto,
      id: `pregunta-${Date.now()}`
    }

    setConversacion(prev => [...prev, nuevaPregunta])
    setInput('') // Limpiar el input
    setIsLoading(true)
    setIsWaitingDelay(true) // Mostrar que está esperando delay

    try {
      // Crear pregunta tipada para el servicio
      const preguntaIA: PreguntaIA = {
        texto: preguntaTexto,
        timestamp: new Date(),
        id: nuevaPregunta.id
      }

      // Enviar pregunta al servicio de IA
      setIsWaitingDelay(false) // Ya no está esperando delay
      const respuestaIA = await enviarPreguntaIA(preguntaIA)

      // Simular streaming de la respuesta
      simularStreaming(respuestaIA.texto)

      // Agregar respuesta al historial cuando termine el streaming
      setTimeout(() => {
        const nuevaRespuesta = {
          tipo: 'respuesta' as const,
          texto: respuestaIA.texto,
          id: `respuesta-${Date.now()}`
        }
        setConversacion(prev => [...prev, nuevaRespuesta])
        setRespuestaStreaming('')

        // Hacer scroll al final del streaming
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 500)
      }, respuestaIA.texto.length * 8 + 3000) // Buffer mucho más grande para evitar duplicación

    } catch (error) {
      console.error('Error al procesar pregunta:', error)
      // Respuesta de error
      const respuestaError = {
        tipo: 'respuesta' as const,
        texto: 'Error al conectar con el servicio de IA. Por favor, verifica que el backend esté funcionando.',
        id: `error-${Date.now()}`
      }
      simularStreaming(respuestaError.texto)

      setTimeout(() => {
        setConversacion(prev => [...prev, respuestaError])
        setRespuestaStreaming('')
      }, respuestaError.texto.length * 15 + 1000)
    } finally {
      setIsLoading(false)
      setIsWaitingDelay(false)
    }
  }

  return (
    <div className={`pb-20 ${isKeyboardOpen ? 'pb-32' : ''}`}>
      {/* Área de chat - sin scroll propio */}
      <div className={`p-4 pt-16 lg:pt-20 pb-20 lg:pb-20 space-y-4 ${isKeyboardOpen ? 'pb-24' : ''}`}>
        {/* Mensaje de bienvenida si no hay conversación */}
        {conversacion.length === 0 && !respuestaStreaming && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto text-center">
              <h3 className="text-xl font-semibold mb-4 text-gray-800 font-poppins">
                ¿En qué te podemos ayudar hoy?
              </h3>
              <p className="text-gray-600 text-sm">
                Consulta sobre parrillas, hornos, kamados y todos nuestros productos
              </p>
            </div>
          </div>
        )}

        {/* Mostrar historial completo de la conversación */}
        {conversacion.map((mensaje) => (
          <div key={mensaje.id} className={`max-w-4xl mx-auto mb-4 ${mensaje.tipo === 'pregunta' ? 'flex justify-end' : 'flex justify-start'
            }`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${mensaje.tipo === 'pregunta'
                ? 'text-white ml-4'
                : 'bg-gray-100 text-gray-800 mr-4'
              }`} style={{
                backgroundColor: mensaje.tipo === 'pregunta' ? 'rgb(52, 152, 219)' : undefined
              }}>
              <div className="leading-relaxed">
                {mensaje.tipo === 'respuesta' ? formatTextWithLinks(mensaje.texto) : mensaje.texto}
              </div>
            </div>
          </div>
        ))}

        {/* Mostrar respuesta con streaming simulado SOLO si está escribiendo */}
        {respuestaStreaming && (
          <div className="max-w-4xl mx-auto mb-4 flex justify-start">
            <div className="max-w-[80%] bg-gray-100 text-gray-800 p-4 rounded-2xl mr-4">
              <div className="leading-relaxed">
                {formatTextWithLinks(respuestaStreaming)}
                <span className="animate-pulse ml-1">|</span>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de "pensando" cuando está procesando pero aún no hay respuesta */}
        {isLoading && !respuestaStreaming && (
          <div className="max-w-4xl mx-auto mb-4 flex justify-start">
            <div className="max-w-[80%] bg-gray-100 text-gray-600 p-4 rounded-2xl mr-4 flex items-center">
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Pensando...</span>
            </div>
          </div>
        )}

        {/* Elemento invisible para scroll automático */}
        <div ref={chatEndRef} />
      </div>

      {/* Input fijo abajo - optimizado para mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              placeholder="¿Qué equipo necesitas? Parrillas, hornos, kamados..."
              value={input}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-poppins text-gray-700 placeholder-gray-500 transition-all duration-200"
            />
            {input.trim() && !isLoading && (
              <button
                type="submit"
                className="px-6 py-3 font-semibold rounded-xl transition-all duration-200 font-poppins flex items-center justify-center min-w-[100px] shadow-lg text-white hover:shadow-xl transform hover:scale-105"
                style={{
                  backgroundColor: 'rgb(52, 152, 219)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(41, 128, 185)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(52, 152, 219)'
                }}
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Enviar</span>
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default ContentIA

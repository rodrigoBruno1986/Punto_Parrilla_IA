import { useState, useEffect, useRef } from 'react'
import type { PreguntaIA } from '../types/ia'
import { enviarPreguntaIA } from '../services/iaService'

// Función para convertir URLs en enlaces clickeables
const formatTextWithLinks = (text: string) => {
  // Primero quitamos los corchetes que rodean las URLs
  const textWithoutBrackets = text.replace(/\[(https?:\/\/[^\]]+)\]/g, '$1')
  
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = textWithoutBrackets.split(urlRegex)
  
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
  const [conversacion, setConversacion] = useState<Array<{tipo: 'pregunta' | 'respuesta', texto: string, id: string}>>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [respuestaStreaming, setRespuestaStreaming] = useState<string>('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll automático hacia abajo cuando cambia el contenido
  useEffect(() => {
    // Solo hacer scroll si hay contenido y no está cargando
    if ((conversacion.length > 0 || respuestaStreaming) && !isLoading) {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 300) // Delay más largo para evitar parpadeo
      
      return () => clearTimeout(timer)
    }
  }, [conversacion.length, respuestaStreaming, isLoading])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Función para simular streaming
  const simularStreaming = (textoCompleto: string) => {
    setRespuestaStreaming('')
    let index = 0
    
    const interval = setInterval(() => {
      if (index < textoCompleto.length) {
        setRespuestaStreaming(textoCompleto.substring(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 8) // 8ms entre caracteres para efecto de streaming más rápido
    
    return interval
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const preguntaTexto = input.trim()
    
    // Agregar pregunta al historial
    const nuevaPregunta = {
      tipo: 'pregunta' as const,
      texto: preguntaTexto,
      id: `pregunta-${Date.now()}`
    }
    
    setConversacion(prev => [...prev, nuevaPregunta])
    setInput('') // Limpiar el input
    setIsLoading(true)
    
    try {
      // Crear pregunta tipada para el servicio
      const preguntaIA: PreguntaIA = {
        texto: preguntaTexto,
        timestamp: new Date(),
        id: nuevaPregunta.id
      }
      
      // Enviar pregunta al servicio de IA
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
      }, respuestaIA.texto.length * 8 + 500) // Tiempo que tarda el streaming + buffer más pequeño
      
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
    }
  }

  return (
    <div className="pb-20">
      {/* Área de chat - sin scroll propio */}
      <div className="p-4 pt-20 space-y-4">
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
          <div key={mensaje.id} className={`max-w-4xl mx-auto mb-4 ${
            mensaje.tipo === 'pregunta' ? 'flex justify-end' : 'flex justify-start'
          }`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${
              mensaje.tipo === 'pregunta' 
                ? 'text-white ml-4' 
                : 'bg-gray-100 text-gray-800 mr-4'
            }`} style={{
              backgroundColor: mensaje.tipo === 'pregunta' ? 'rgb(52, 152, 219)' : undefined
            }}>
              <p className="leading-relaxed">
                {mensaje.tipo === 'respuesta' ? formatTextWithLinks(mensaje.texto) : mensaje.texto}
              </p>
            </div>
          </div>
        ))}

        {/* Mostrar respuesta con streaming simulado SOLO si está escribiendo */}
        {respuestaStreaming && (
          <div className="max-w-4xl mx-auto mb-4 flex justify-start">
            <div className="max-w-[80%] bg-gray-100 text-gray-800 p-4 rounded-2xl mr-4">
              <p className="leading-relaxed">
                {formatTextWithLinks(respuestaStreaming)}
                {isLoading && <span className="animate-pulse">|</span>}
              </p>
            </div>
          </div>
        )}
        
        {/* Elemento invisible para scroll automático */}
        <div ref={chatEndRef} />
      </div>

      {/* Input fijo abajo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white p-4 z-50">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="¿Qué equipo necesitas? Parrillas, hornos, kamados..."
              value={input}
              onChange={handleInputChange}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-poppins"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors duration-200 font-poppins ${
                input.trim() && !isLoading 
                  ? 'text-white' 
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }`}
              style={{
                backgroundColor: input.trim() && !isLoading ? 'rgb(52, 152, 219)' : undefined
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !isLoading) {
                  e.currentTarget.style.backgroundColor = 'rgb(41, 128, 185)'
                }
              }}
              onMouseLeave={(e) => {
                if (input.trim() && !isLoading) {
                  e.currentTarget.style.backgroundColor = 'rgb(52, 152, 219)'
                }
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enviando...
                </div>
              ) : 'Enviar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ContentIA

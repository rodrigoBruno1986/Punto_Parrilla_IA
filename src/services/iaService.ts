import axios from 'axios'
import type { PreguntaIA, RespuestaIA } from '../types/ia'
import dataPuntoParrilla from '../data/puntoParrilla.json'

// Variable para controlar peticiones simultáneas
let isRequestInProgress = false
let lastRequestTime = 0
let requestCount = 0

// Configuración de axios para petición directa a OpenRouter
const openrouterApi = axios.create({
    baseURL: 'https://openrouter.ai/api/v1', // Petición directa
    timeout: 15000,
    headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5174',
        'X-Title': 'Punto Parrilla IA'
    }
})

// Servicio para enviar pregunta a OpenRouter usando axios
export const enviarPreguntaIA = async (pregunta: PreguntaIA): Promise<RespuestaIA> => {
    requestCount++
    console.log(`🔄 Intento de petición #${requestCount}`)
    
    // Prevenir múltiples peticiones simultáneas
    if (isRequestInProgress) {
        console.log('⚠️ Petición ya en progreso, esperando...')
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!isRequestInProgress) {
                    clearInterval(checkInterval)
                    console.log('✅ Petición anterior completada, reintentando...')
                    resolve(enviarPreguntaIA(pregunta))
                }
            }, 1000)
        })
    }

    isRequestInProgress = true
    console.log('🚀 Iniciando nueva petición...')
    
    // Agregar delay entre peticiones para evitar rate limiting
    const currentTime = Date.now()
    const timeSinceLastRequest = currentTime - lastRequestTime
    const minDelay = 5000 // 5 segundos mínimo entre peticiones
    
    // Si es la primera petición, esperar un poco
    if (lastRequestTime === 0) {
        console.log('⏰ Primera petición, esperando 2 segundos...')
        await new Promise(resolve => setTimeout(resolve, 2000))
    } else if (timeSinceLastRequest < minDelay) {
        const waitTime = minDelay - timeSinceLastRequest
        console.log(`⏰ Esperando ${waitTime}ms para evitar rate limiting...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    lastRequestTime = Date.now()
    console.log(`📤 Enviando petición a OpenRouter: "${pregunta.texto.substring(0, 50)}..."`)
    
    try {
        console.log('🔑 API Key presente:', !!import.meta.env.VITE_OPENROUTER_API_KEY)
        console.log('🌐 URL completa:', 'https://openrouter.ai/api/v1/chat/completions')

        const response = await openrouterApi.post('/chat/completions', {
            model: 'openai/gpt-oss-20b:free',
            temperature: 0.6, // Natural pero sin inventar
            top_p: 1, // Valor por defecto
            max_tokens: 800, // Pasos + tips + información de productos
            presence_penalty: 0.1, // Evita repetición de temas
            frequency_penalty: 0.2, // Evita repetición de palabras
            stream: false, // Procesamos todo y renderizamos al final
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente especializado en Punto Parrilla, distribuidor oficial de Tromen. Responde de manera amigable y útil sobre parrillas, hornos, kamados y accesorios para parrilla.

FORMATO DE RESPUESTA:
- Usá frases cortas y claras
- Encabezados solo si aportan (máx. 3)
- Bullets antes que párrafos largos
- Cantidades en unidades prácticas (ml/oz, °C/°F si aplica)
- Tips al final bajo "Tips rápidos"

PROHIBIDO:
- No inventes marcas ni equipos raros
- No metas advertencias obvias o de sentido común
- No pongas tablas salvo que sean necesarias
- No repitas lo ya dicho

ESTILO DE SALIDA:
- Arrancá con una línea introductoria de 1 renglón
- Después, pasos numerados concisos
- Cerrá con 3–5 tips puntuales

DATOS DE PUNTO PARRILLA:
${JSON.stringify(dataPuntoParrilla, null, 2)}`
                },
                {
                    role: 'user',
                    content: pregunta.texto
                }
            ]
        })

        const respuestaTexto = response.data.choices[0].message.content || 'No se pudo obtener respuesta'
        console.log('✅ Respuesta de OpenRouter recibida exitosamente')
        console.log('📝 Longitud de respuesta:', respuestaTexto.length, 'caracteres')

        const respuesta: RespuestaIA = {
            texto: respuestaTexto,
            timestamp: new Date(),
            id: `respuesta-${Date.now()}`
        }

        return respuesta

    } catch (error) {
        console.error('❌ Error al enviar pregunta a OpenRouter:', error)
        console.error('📊 Detalles del error:', {
            status: (error as any).response?.status,
            message: (error as any).message,
            requestCount: requestCount,
            timeSinceLastRequest: Date.now() - lastRequestTime
        })

        const respuestaError: RespuestaIA = {
            texto: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.',
            timestamp: new Date(),
            id: `error-${Date.now()}`
        }

        return respuestaError
    } finally {
        // Liberar la bandera de petición en progreso
        isRequestInProgress = false
        console.log('🏁 Petición completada, bandera liberada')
    }
}

export const verificarEstadoIA = async (): Promise<boolean> => {
    try {
        // Verificar si tenemos API key configurada
        return !!(import.meta.env.VITE_OPENROUTER_API_KEY)
    } catch (error) {
        console.error('Error al verificar estado de IA:', error)
        return false
    }
}
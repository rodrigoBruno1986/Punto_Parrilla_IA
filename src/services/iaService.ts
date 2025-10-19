import axios from 'axios'
import type { PreguntaIA, RespuestaIA } from '../types/ia'
import dataPuntoParrilla from '../data/puntoParrilla.json'

// Variables para controlar peticiones simultáneas
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
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Punto Parrilla IA'
    }
})

// Servicio para enviar pregunta a OpenRouter usando axios
export const enviarPreguntaIA = async (pregunta: PreguntaIA): Promise<RespuestaIA> => {
    requestCount++
    console.log(`🔄 Intento de petición #${requestCount}`)
    
    // Prevenir múltiples peticiones simultáneas - BLOQUEAR completamente
    if (isRequestInProgress) {
        console.log('🚫 Petición bloqueada - Ya hay una petición en progreso')
        const respuestaBloqueada: RespuestaIA = {
            texto: 'Por favor, espera a que termine la respuesta anterior antes de hacer una nueva pregunta.',
            timestamp: new Date(),
            id: `bloqueada-${Date.now()}`
        }
        return respuestaBloqueada
    }

    isRequestInProgress = true
    console.log('🚀 Iniciando nueva petición...')
    
    // Agregar delay entre peticiones para evitar rate limiting
    const minDelay = 5000 // 5 segundos mínimo entre peticiones
    
    if (lastRequestTime === 0) {
        console.log('⏰ Primera petición, esperando 3 segundos...')
        await new Promise(resolve => setTimeout(resolve, 3000))
    } else {
        const currentTime = Date.now()
        const timeSinceLastRequest = currentTime - lastRequestTime
        
        if (timeSinceLastRequest < minDelay) {
            const waitTime = minDelay - timeSinceLastRequest
            console.log(`⏰ Esperando ${waitTime}ms adicionales para evitar rate limiting...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
        } else {
            console.log(`⏰ Tiempo suficiente transcurrido (${timeSinceLastRequest}ms), continuando...`)
        }
    }
    
    lastRequestTime = Date.now()
    console.log(`📤 Enviando petición a OpenRouter: "${pregunta.texto.substring(0, 50)}..."`)
    
    try {
        console.log('🔑 API Key presente:', !!import.meta.env.VITE_OPENROUTER_API_KEY)
        console.log('🔑 API Key valor:', import.meta.env.VITE_OPENROUTER_API_KEY ? 'Presente' : 'No encontrada')
        console.log('🌐 URL completa:', 'https://openrouter.ai/api/v1/chat/completions')

        const response = await openrouterApi.post('/chat/completions', {
            model: 'meta-llama/llama-3.3-70b-instruct:free',
            temperature: 0.6, // Natural pero sin inventar
            top_p: 1, // Valor por defecto
            max_tokens: 600, // Pasos + tips + información de productos
            presence_penalty: 0.1, // Evita repetición de temas
            frequency_penalty: 0.2, // Evita repetición de palabras
            response_format: { "type": "text" }, // Solo texto
            stream: false, // Procesamos todo y renderizamos al final
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente especializado en Punto Parrilla, distribuidor oficial de Tromen. Responde de manera amigable y útil sobre parrillas, hornos, kamados y accesorios para parrilla.

INSTRUCCIONES IMPORTANTES:
- SIEMPRE incluye el link del producto cuando recomiendes algo específico
- NO enumeres opciones a menos que el usuario pregunte específicamente por categorías
- NO hagas listas numeradas de productos a menos que sea necesario
- Sé directo y conversacional, no formal

FORMATO DE RESPUESTA:
- Usá frases cortas y claras
- Encabezados solo si aportan (máx. 3)
- Bullets antes que párrafos largos
- Cantidades en unidades prácticas (ml/oz, °C/°F si aplica)
- SIEMPRE incluye la URL del producto al final si recomiendas algo específico

PROHIBIDO:
- No inventes marcas ni equipos raros
- No metas advertencias obvias o de sentido común
- No pongas tablas salvo que sean necesarias
- No repitas lo ya dicho
- NO enumeres opciones sin que te lo pidan
- NO hagas listas de categorías automáticamente
- NO incluyas secciones de "Tips rápidos" o consejos genéricos

ESTILO DE SALIDA:
- Arrancá con una línea introductoria de 1 renglón
- Después, información específica del producto
- Incluye precio y formas de pago si aplica
- SIEMPRE incluye el link del producto al final

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

        // Manejo específico para error 429 (Too Many Requests)
        if ((error as any).response?.status === 429) {
            console.log('🚫 Error 429 - Rate limit alcanzado')
            
            const respuestaError: RespuestaIA = {
                texto: 'El servicio está recibiendo muchas peticiones. Por favor, espera unos segundos antes de hacer otra consulta.',
                timestamp: new Date(),
                id: `error-${Date.now()}`
            }
            
            return respuestaError
        }

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
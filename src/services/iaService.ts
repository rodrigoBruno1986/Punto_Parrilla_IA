import axios from 'axios'
import type { PreguntaIA, RespuestaIA } from '../types/ia'
import dataPuntoParrilla from '../data/puntoParrilla.json'

// Configuración de axios para usar el proxy de Vite
const openrouterApi = axios.create({
    baseURL: '/api/openrouter', // Usa el proxy de Vite
    timeout: 30000,
    headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5174',
        'X-Title': 'Punto Parrilla IA'
    }
})

// Servicio para enviar pregunta a OpenRouter usando axios
export const enviarPreguntaIA = async (pregunta: PreguntaIA): Promise<RespuestaIA> => {
    try {
        console.log('Enviando pregunta a OpenRouter:', pregunta.texto)
        console.log('API Key presente:', !!import.meta.env.VITE_OPENROUTER_API_KEY)

        const response = await openrouterApi.post('/chat/completions', {
            model: 'openai/gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente especializado en Punto Parrilla, distribuidor oficial de Tromen. Tienes acceso a la siguiente información sobre la empresa:

INFORMACIÓN DE PUNTO PARRILLA:
${JSON.stringify(dataPuntoParrilla, null, 2)}

INSTRUCCIONES:
- Eres parte del equipo de Punto Parrilla, habla como si fueras un experto de nuestra tienda
- Usa expresiones como "con nosotros", "nuestros productos", "te recomendamos", "en Punto Parrilla"
- Sé cercano y personalizado, como si fueras un asesor especializado de la tienda
- Recomienda productos específicos con precios cuando sea apropiado
- Para cada producto, revisa su información específica de promociones y formas de pago antes de mencionarlas
- No asumas que todos los productos tienen las mismas promociones
- Siempre recomienda productos relacionados a lo que pregunta el usuario
- Si preguntan sobre comida en general, redirige hacia nuestros productos de parrilla
- Incluye información de contacto cuando sea relevante
- Cuando recomiendes un producto específico, incluye su URL una sola vez al final
- Mantén las respuestas concisas y evita repetir información
- Si no hay URL específica del producto, no menciones la URL general del sitio`
                },
                {
                    role: 'user',
                    content: pregunta.texto
                }
            ]
        })

        const respuestaTexto = response.data.choices[0].message.content || 'No se pudo obtener respuesta'
        console.log('Respuesta de OpenRouter recibida:', respuestaTexto)

        const respuesta: RespuestaIA = {
            texto: respuestaTexto,
            timestamp: new Date(),
            id: `respuesta-${Date.now()}`
        }

        return respuesta

    } catch (error) {
        console.error('Error al enviar pregunta a OpenRouter:', error)

        const respuestaError: RespuestaIA = {
            texto: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.',
            timestamp: new Date(),
            id: `error-${Date.now()}`
        }

        return respuestaError
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
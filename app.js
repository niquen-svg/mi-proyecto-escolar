// ============================================================
//  CARGA DE CONOCIMIENTO DESDE ARCHIVO EXTERNO
// ============================================================

let baseConocimiento = {};

async function cargarConocimiento() {
    try {
        const response = await fetch('conocimiento.json');
        if (!response.ok) throw new Error('Error al cargar conocimiento.json');
        baseConocimiento = await response.json();
        console.log('✅ Conocimiento cargado correctamente:', Object.keys(baseConocimiento));
    } catch (error) {
        console.error('❌ Error al cargar conocimiento:', error);
        alert('No se pudo cargar la base de conocimiento. Revisa el archivo conocimiento.json');
    }
}

// Llamar a la función al cargar la página
cargarConocimiento();

// ============================================================
//  FUNCIÓN PARA NORMALIZAR TEXTO (eliminar tildes y mayúsculas)
// ============================================================

function normalizarTexto(texto) {
    return texto.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// ============================================================
//  LISTA DE SALUDOS PARA ACTIVAR LA BIENVENIDA
// ============================================================

const SALUDOS = [
    "hola", "buenos días", "buenas", "hey", "hola!", "qué tal", 
    "como estas", "buen día", "saludos", "holi", "holis", "hi",
    "hello", "que tal", "como andas"
];

// ============================================================
//  CONEXIÓN CON GEMINI
// ============================================================

// 🔑 REEMPLAZA 'TU_CLAVE_API_AQUI' POR TU CLAVE REAL DE GOOGLE AI STUDIO
const API_KEY = process.env.apigem;

async function consultarGemini(prompt) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Error de Gemini:', errorData);
            throw new Error(`Error HTTP: ${response.status} - ${errorData.error?.message || 'Sin detalles'}`);
        }

        const data = await response.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                      'Lo siento, no pude generar una respuesta.';
        return texto;
    } catch (error) {
        console.error('❌ Error al consultar Gemini:', error);
        return null; // Fallback a respuestas predefinidas
    }
}

// ============================================================
//  CONSTRUIR MENSAJE DE BIENVENIDA
// ============================================================

function construirMensajeBienvenida() {
    // Obtener los nombres y entornos de todos los investigadores
    const investigadores = Object.values(baseConocimiento).map(info => {
        return `- **${info.nombre}** → ${info.entorno}`;
    }).join('\n');

    const preguntasEjemplo = [
        "¿Cómo son los frailejones? (Montañas)",
        "¿Por qué migran los ñus? (Sabana)",
        "¿Qué animales viven en los bosques? (Bosques)",
        "¿Qué es una pradera? (Praderas)",
        "¿Por qué los océanos producen oxígeno? (Océanos)"
    ].map(p => `• ${p}`).join('\n');

    return `🌍 **¡Bienvenido al Cerebro Artificial LIAMM!** 🌍

Somos un equipo de 5 jóvenes exploradores que han investigado a fondo diferentes ecosistemas. Cada uno de nosotros es experto en su entorno y estamos aquí para responder tus preguntas y ayudarte a conocer y proteger la naturaleza.

👦 **Nuestros investigadores y sus ecosistemas:**
${investigadores}

🔍 **¿Qué puedes preguntar?**
- **Sobre el ecosistema**: clima, flora, fauna, curiosidades, amenazas.
- **Sobre el estado de salud**: si describes lo que has visto (ej: "vi nieve gris"), podemos evaluar si está sano, regular o crítico.
- **Sobre cómo cuidarlo**: acciones concretas para proteger cada entorno.

💡 **Ejemplos de preguntas que puedes hacer:**
${preguntasEjemplo}

✨ **¡Elige un ecosistema y comienza a explorar!** Solo escríbenos tu pregunta y el investigador adecuado te responderá.

_Recuerda: cada investigador solo conoce su ecosistema, así que si preguntas sobre montañas, te responderá Mathias; si preguntas sobre océanos, te responderá Isabela._`;
}

// ============================================================
//  CONSTRUIR PROMPT (ESTILO NIÑO EXPLORADOR + DETECCIÓN MEJORADA)
// ============================================================

function construirPrompt(info, consultaUsuario) {
    const nombre = info.nombre;
    const entorno = info.entorno;
    const presentacion = info.presentacion;
    const metodo = info.metodo;
    const eco = info.ecosistema;
    const indicadores = info.indicadores;
    const conceptos = info.concepto || "";
    const importancia = info.importancia || [];
    const curiosidades = info.curiosidades || [];
    const preguntasSugeridas = info.preguntasSugeridas || [];
    const tipos = info.tiposMontana || info.tiposSabanas || info.tiposPraderas || info.tiposBosques || [];

    // Convertir lista de preguntas sugeridas en una cadena para el prompt
    const preguntasTexto = preguntasSugeridas.map(p => `- "${p}"`).join('\n');

    // Detectar si la consulta es general/informativa o específica/observacional
    const palabrasClaveGenerales = ["qué es", "qué son", "cómo son", "cómo es", "qué significa", "definición", "explica", "cuéntame", "información", "datos", "curiosidades", "características", "describe"];
    const palabrasClaveObservacion = ["veo", "vi", "hay", "está", "noté", "observé", "encontré", "vi que", "noto que", "hay mucho", "está seco", "está mojado", "está quemado", "derritiendo", "contaminado"];

    const esInformativa = palabrasClaveGenerales.some(palabra => consultaUsuario.toLowerCase().includes(palabra));
    const esObservacional = palabrasClaveObservacion.some(palabra => consultaUsuario.toLowerCase().includes(palabra));

    // Si la consulta es informativa Y NO es observacional, solo dar información
    const esSoloInformativa = esInformativa && !esObservacional;

    // Extraer solo los nombres de los indicadores y sus estados (para diagnóstico)
    const indicadoresResumen = indicadores.map(ind => {
        return `${ind.icono} ${ind.label}: 
        - Sano: ${ind.estados.sano.texto}
        - Regular: ${ind.estados.regular.texto}
        - Crítico: ${ind.estados.critico.texto}`;
    }).join('\n');

    let instruccionAdicional = "";

    if (esSoloInformativa) {
        // Modo: solo información, sin diagnóstico
        instruccionAdicional = `
        IMPORTANTE: El usuario te está preguntando sobre información general de ${entorno}. 
        NO debes dar un diagnóstico de salud (sano/regular/crítico) ni mencionar indicadores afectados.
        Solo responde con la información que se te pide, basada en tu investigación.
        Si el usuario pregunta sobre un concepto específico (como "frailejones", "glaciares", etc.), usa tu conocimiento para describirlo.
        
        Puedes ofrecer opciones de seguimiento al final, usando estas preguntas sugeridas:
        ${preguntasTexto}
        
        Asegúrate de no inventar información. Si no sabes algo, di: "No tengo información sobre eso en mi libreta de campo."
        `;
    } else if (esObservacional) {
        // Modo: el usuario describe algo que ha visto → evaluar estado
        instruccionAdicional = `
        IMPORTANTE: El usuario te está contando algo que ha visto en ${entorno}. 
        Usa tus indicadores para evaluar el estado del ecosistema (sano/regular/crítico) y da un diagnóstico basado en los datos de tu investigación.
        
        Responde con:
        1. Un diagnóstico claro del estado del ecosistema.
        2. Menciona qué indicadores están afectados y por qué.
        3. Ofrece sugerencias concretas y divertidas para cuidar ${entorno}.
        
        Si no encuentras información suficiente en los datos para evaluar el estado, di: "No tengo suficiente información en mi libreta de campo para dar un diagnóstico preciso de lo que describes."
        `;
    } else {
        // Modo híbrido: no hay palabras clave claras → asumimos que es informativa por defecto
        instruccionAdicional = `
        IMPORTANTE: El usuario no ha especificado claramente si quiere información o si describe una observación. 
        Respóndele de forma amable, ofreciéndole información general sobre ${entorno}.
        
        Si el usuario menciona algún detalle (como "nieve gris", "árboles secos"), puedes preguntarle si quiere que evalúes el estado del ecosistema.
        
        Puedes ofrecer opciones de seguimiento al final, usando estas preguntas sugeridas:
        ${preguntasTexto}
        `;
    }

    // --- CONSTRUIR EL PROMPT FINAL ---

    // Datos adicionales (concepto, importancia, curiosidades, tipos) para enriquecer respuestas
    let datosExtra = "";
    if (conceptos) datosExtra += `\nCONCEPTO: ${conceptos}`;
    if (importancia.length > 0) datosExtra += `\nIMPORTANCIA: ${importancia.join(', ')}`;
    if (curiosidades.length > 0) datosExtra += `\nCURIOSIDADES: ${curiosidades.join(', ')}`;
    if (tipos.length > 0) {
        const tiposTexto = tipos.map(t => `- ${t.nombre}: ${t.descripcion}`).join('\n');
        datosExtra += `\nTIPOS DE ${entorno.toUpperCase()}:\n${tiposTexto}`;
    }

    return `Eres ${nombre}, un joven explorador y científico que ha investigado a fondo el ecosistema de ${entorno}. 
Has viajado por esos paisajes, has tomado notas y has aprendido de primera mano cómo funciona la naturaleza en ese lugar.

Tu personalidad: ${presentacion}
Tu método de investigación: ${metodo}

ESTA ES TU INVESTIGACIÓN (tu base de conocimiento, no debes inventar nada fuera de esto):
- Clima: ${eco.clima}
- Flora: ${eco.flora.join(', ')}
- Fauna: ${eco.fauna.join(', ')}
- Amenazas que has identificado: ${eco.amenazas.join(', ')}
- Acciones que recomiendas para cuidar el ecosistema: ${eco.conservacion.join(', ')}
${datosExtra}

TUS INDICADORES DE SALUD (para evaluar el estado del ecosistema):
${indicadoresResumen}

Ahora, un niño o niña como tú te pregunta: "${consultaUsuario}"

${instruccionAdicional}

RESPONDE CON ESTE ESTILO (como un niño explorador que comparte su conocimiento con emoción):
- Usa un lenguaje cálido, entusiasta y sencillo, como si estuvieras contando un secreto de la naturaleza.
- Empieza tu respuesta con una frase como: "¡Hola! Según la investigación que he hecho en ${entorno}..."
- Si el usuario ha hecho una pregunta informativa, responde directamente y termina con una invitación a seguir aprendiendo.
- Si el usuario describe una observación, da un diagnóstico claro y luego ofrece sugerencias.
- Termina siempre de forma amable y abierta a más preguntas.

REGLAS IMPORTANTES:
- No inventes información que no esté en tu investigación (los datos que te di).
- Si no sabes algo, di: "No tengo información sobre eso en mi libreta de campo, pero puedo ayudarte con lo que sé de ${entorno}."
- Si el usuario pregunta algo fuera del contexto de ${entorno}, responde: "Eso no tiene que ver con mi investigación sobre ${entorno}. ¿Te gustaría saber más sobre ${entorno}?"
- Responde en máximo 200 palabras, pero que sea claro y emocionante.`;
}

// ============================================================
//  FUNCIÓN PARA ABRIR EL MODAL CON LOS INDICADORES VISUALES
// ============================================================

function abrirPerfilInvestigador(nombre) {
    // Verificar que el conocimiento esté cargado
    if (Object.keys(baseConocimiento).length === 0) {
        alert('La base de conocimiento aún se está cargando. Por favor, espera un momento.');
        return;
    }

    const info = baseConocimiento[nombre];
    if (!info) {
        alert('Perfil en construcción. ¡Próximamente más información!');
        return;
    }

    const modalContenido = document.getElementById('modal-contenido');

    let indicadoresHTML = '';
    info.indicadores.forEach(ind => {
        const sano = ind.estados.sano;
        const regular = ind.estados.regular;
        const critico = ind.estados.critico;

        indicadoresHTML += `
            <div class="indicador-card bg-slate-950/50 border border-slate-800 rounded-xl p-3 mb-3">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">${ind.icono}</span>
                    <span class="text-sm font-bold text-cyan-400 uppercase">${ind.label}</span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-xs">
                    <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                        <div class="text-3xl">${sano.imagen}</div>
                        <div class="text-emerald-400 font-bold mt-1">Sano</div>
                        <div class="text-slate-300">${sano.texto}</div>
                    </div>
                    <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-center">
                        <div class="text-3xl">${regular.imagen}</div>
                        <div class="text-amber-400 font-bold mt-1">Regular</div>
                        <div class="text-slate-300">${regular.texto}</div>
                    </div>
                    <div class="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 text-center">
                        <div class="text-3xl">${critico.imagen}</div>
                        <div class="text-rose-400 font-bold mt-1">Crítico</div>
                        <div class="text-slate-300">${critico.texto}</div>
                    </div>
                </div>
            </div>
        `;
    });

    modalContenido.innerHTML = `
        <div class="flex items-center gap-4 border-b border-slate-800 pb-4">
            <div class="text-6xl">${info.avatar}</div>
            <div>
                <h2 class="text-xl font-black text-white">${info.nombre}</h2>
                <p class="text-xs text-slate-400 font-mono">${info.entorno}</p>
            </div>
        </div>

        <div class="space-y-2">
            <h4 class="text-xs font-bold text-cyan-400 uppercase font-mono">🧪 Mi investigación</h4>
            <p class="text-sm text-slate-300 leading-relaxed">${info.presentacion}</p>
            <p class="text-xs text-slate-400 italic">${info.metodo}</p>
        </div>

        <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <h4 class="text-xs font-bold text-cyan-400 uppercase">📊 Indicadores de Salud Ambiental</h4>
            ${indicadoresHTML}
        </div>

        <div class="flex justify-end">
            <button onclick="cerrarModal()" class="text-slate-500 hover:text-white text-xs font-mono bg-slate-950 px-4 py-2 rounded border border-slate-800 transition-all">
                CERRAR [X]
            </button>
        </div>
    `;

    document.getElementById('modal-perfil').classList.remove('hidden');
    document.body.classList.add('modal-abierto');
}

function cerrarModal() {
    document.getElementById('modal-perfil').classList.add('hidden');
    document.body.classList.remove('modal-abierto');
}

// ============================================================
//  FUNCIÓN PARA EVALUAR EL ESTADO DE UN INDICADOR SEGÚN TEXTO
// ============================================================

function evaluarEstadoIndicador(texto, estados) {
    const orden = ['critico', 'regular', 'sano'];
    for (let nivel of orden) {
        const estado = estados[nivel];
        if (!estado) continue;
        for (let palabra of estado.keywords) {
            if (texto.includes(palabra)) {
                return nivel;
            }
        }
    }
    return 'sano';
}

// ============================================================
//  ENVIAR PREGUNTA (CHAT) CON GEMINI Y NUEVO PROMPT
// ============================================================

async function enviarPregunta() {
    // Verificar que el conocimiento esté cargado
    if (Object.keys(baseConocimiento).length === 0) {
        alert('La base de conocimiento aún se está cargando. Por favor, espera un momento.');
        return;
    }

    const input = document.getElementById('input-busqueda');
    const textoUsuario = input.value.trim();
    if (textoUsuario === "") return;

    // Normalizar el texto para comparaciones
    const textoNormalizado = normalizarTexto(textoUsuario);
    const textoLower = textoUsuario.toLowerCase();

    // Borrar input inmediatamente
    input.value = "";

    // Mostrar chat si está oculto
    const zonaChat = document.getElementById('zona-chat-central');
    const mapaNodos = document.getElementById('mapa-nodos-central');
    if (zonaChat.classList.contains('hidden')) {
        mapaNodos.classList.add('hidden');
        zonaChat.classList.remove('hidden');
    }

    const pantallaChat = document.getElementById('pantalla-chat');

    // ------------------------------
    // DETECTAR SALUDO
    // ------------------------------
    const esSaludo = SALUDOS.some(saludo => textoNormalizado.includes(normalizarTexto(saludo)));
    
    if (esSaludo) {
        // Agregar mensaje del usuario (el saludo)
        pantallaChat.innerHTML += `
            <div class="bg-cyan-950/30 border border-cyan-500/20 p-4 rounded-xl text-right max-w-2xl ml-auto">
                <span class="text-[10px] font-mono text-cyan-400 uppercase block">CONSULTA GENERAL >></span>
                <p class="text-sm text-slate-200 mt-1">${textoUsuario}</p>
            </div>
        `;

        // Crear mensaje de bienvenida
        const mensajeBienvenida = construirMensajeBienvenida();
        
        // Mostrar la bienvenida
        const mensajeDiv = document.createElement('div');
        mensajeDiv.className = `bg-slate-900 border border-slate-800 p-4 rounded-xl max-w-3xl space-y-2 border-l-4 border-l-emerald-500`;
        mensajeDiv.innerHTML = `
            <span class="text-[10px] font-mono text-cyan-400 uppercase block">CEREBRO_ARTIFICIAL_LOG >></span>
            <p class="text-sm text-slate-300">${mensajeBienvenida}</p>
        `;
        pantallaChat.appendChild(mensajeDiv);
        pantallaChat.scrollTop = pantallaChat.scrollHeight;
        return; // Salimos de la función, no seguimos con la IA
    }

    // ------------------------------
    // AGREGAR MENSAJE DEL USUARIO
    // ------------------------------
    pantallaChat.innerHTML += `
        <div class="bg-cyan-950/30 border border-cyan-500/20 p-4 rounded-xl text-right max-w-2xl ml-auto">
            <span class="text-[10px] font-mono text-cyan-400 uppercase block">CONSULTA GENERAL >></span>
            <p class="text-sm text-slate-200 mt-1">${textoUsuario}</p>
        </div>
    `;

    // ------------------------------
    // MOSTRAR MENSAJE DE "PENSANDO..."
    // ------------------------------
    const mensajePensando = document.createElement('div');
    mensajePensando.id = 'mensaje-pensando';
    mensajePensando.className = 'bg-slate-800/50 border border-slate-700 p-4 rounded-xl max-w-3xl animate-pulse';
    mensajePensando.innerHTML = `
        <span class="text-[10px] font-mono text-cyan-400 uppercase block">CEREBRO_ARTIFICIAL_LOG >></span>
        <div class="flex items-center gap-3 mt-2">
            <div class="w-3 h-3 bg-cyan-400 rounded-full animate-bounce"></div>
            <div class="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
            <div class="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0.4s;"></div>
            <span class="text-sm text-slate-300">⏳ Pensando... El Cerebro Artificial está analizando tu consulta</span>
        </div>
    `;
    pantallaChat.appendChild(mensajePensando);
    pantallaChat.scrollTop = pantallaChat.scrollHeight;

    // ------------------------------
    // DETECTAR EL INVESTIGADOR (usando palabras clave normalizadas)
    // ------------------------------
    let ninoObjetivo = null;
    let maxCoincidencias = 0;
    const textoNormalizadoParaDetectar = normalizarTexto(textoUsuario);

    for (const [nombre, datos] of Object.entries(baseConocimiento)) {
        // Normalizar cada palabra clave del perfil
        const coincidencias = datos.palabrasClave.filter(palabra => 
            textoNormalizadoParaDetectar.includes(normalizarTexto(palabra))
        ).length;
        
        if (coincidencias > maxCoincidencias) {
            maxCoincidencias = coincidencias;
            ninoObjetivo = nombre;
        }
    }

    // Si no se detectó ningún perfil, usar Mathias por defecto (pero con mensaje en consola)
    if (!ninoObjetivo) {
        ninoObjetivo = "Mathias";
        console.warn('No se detectó un ecosistema claro. Usando Mathias por defecto.');
    }

    const info = baseConocimiento[ninoObjetivo];

    // ------------------------------
    // EVALUAR CADA INDICADOR PARA OBTENER UN NIVEL DE GRAVEDAD GLOBAL (por si falla Gemini)
    // ------------------------------
    let contadorSano = 0, contadorRegular = 0, contadorCritico = 0;
    const detallesIndicadores = [];

    info.indicadores.forEach(ind => {
        const nivel = evaluarEstadoIndicador(textoLower, ind.estados);
        if (nivel === 'sano') contadorSano++;
        else if (nivel === 'regular') contadorRegular++;
        else if (nivel === 'critico') contadorCritico++;

        const estadoObj = ind.estados[nivel];
        detallesIndicadores.push({
            label: ind.label,
            nivel: nivel,
            texto: estadoObj.texto,
            imagen: estadoObj.imagen
        });
    });

    let gravedadGlobal = 'sano';
    if (contadorCritico >= contadorRegular && contadorCritico >= contadorSano && contadorCritico > 0) {
        gravedadGlobal = 'critico';
    } else if (contadorRegular >= contadorSano && contadorRegular > 0) {
        gravedadGlobal = 'regular';
    }

    // ------------------------------
    // CONSTRUIR EL PROMPT Y LLAMAR A GEMINI
    // ------------------------------
    const prompt = construirPrompt(info, textoUsuario);
    let respuestaIA = await consultarGemini(prompt);
    let mensajeRespuesta;

    // Eliminar mensaje de "pensando..."
    const mensajePensandoElement = document.getElementById('mensaje-pensando');
    if (mensajePensandoElement) {
        mensajePensandoElement.remove();
    }

    if (respuestaIA) {
        // Respuesta generada por Gemini
        mensajeRespuesta = `🔍 <strong>${info.nombre}</strong> dice: <br>${respuestaIA}`;
    } else {
        // Fallback: usar respuesta predefinida
        const respuesta = info.respuestas[gravedadGlobal];
        mensajeRespuesta = `🔍 <strong>${info.nombre}</strong> dice: <br>`;
        mensajeRespuesta += `<strong>Diagnóstico:</strong> ${respuesta.diagnostico}<br>`;
        mensajeRespuesta += `<strong>Solución:</strong> ${respuesta.solucion}<br><br>`;

        const indicadoresAfectados = detallesIndicadores.filter(d => d.nivel !== 'sano');
        if (indicadoresAfectados.length > 0) {
            mensajeRespuesta += `<span class="text-cyan-400">📋 Indicadores detectados:</span><br>`;
            indicadoresAfectados.forEach(d => {
                const color = d.nivel === 'critico' ? 'text-rose-400' : 'text-amber-400';
                mensajeRespuesta += `<span class="${color}">${d.imagen} ${d.label}: ${d.texto}</span><br>`;
            });
        } else {
            mensajeRespuesta += `<span class="text-emerald-400">✅ Todos los indicadores están en estado saludable.</span>`;
        }
    }

    // ------------------------------
    // MOSTRAR RESPUESTA EN EL CHAT (sin delay)
    // ------------------------------
    const mensajeRespuestaDiv = document.createElement('div');
    mensajeRespuestaDiv.className = `bg-slate-900 border border-slate-800 p-4 rounded-xl max-w-3xl space-y-2 border-l-4 ${gravedadGlobal === 'critico' ? 'border-l-rose-500' : gravedadGlobal === 'regular' ? 'border-l-amber-500' : 'border-l-emerald-500'}`;
    mensajeRespuestaDiv.innerHTML = `
        <span class="text-[10px] font-mono text-cyan-400 uppercase block">CEREBRO_ARTIFICIAL_LOG >></span>
        <p class="text-sm text-slate-300">${mensajeRespuesta}</p>
    `;
    pantallaChat.appendChild(mensajeRespuestaDiv);
    pantallaChat.scrollTop = pantallaChat.scrollHeight;
}

// ============================================================
//  RESETEAR CONSOLA (VOLVER AL MAPA)
// ============================================================

function resetearConsola() {
    cerrarModal();
    document.getElementById('zona-chat-central').classList.add('hidden');
    document.getElementById('mapa-nodos-central').classList.remove('hidden');
    document.getElementById('pantalla-chat').innerHTML = '';
}

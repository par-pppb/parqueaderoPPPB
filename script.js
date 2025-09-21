// script.js

// 1. Importa las funciones necesarias de Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// Importar jsPDF globalmente (ya se cargó via CDN en el HTML)
const { jsPDF } = window.jspdf;

// 2. Tu configuración de Firebase (REEMPLAZA ESTO CON TUS PROPIAS CREDENCIALES)
const firebaseConfig = {
    apiKey: "AIzaSyDUIyk4gKjkodIbo9L-6d1EzbP4Y0eDAmo ", // <--- REEMPLAZA
    authDomain: "parqueadero-pppb.firebaseapp.com ", // <--- REEMPLAZA
    projectId: "parqueadero-pppb", // <--- REEMPLAZA
    storageBucket: "parqueadero-pppb.firebasestorage.app", // <--- REEMPLAZA
    messagingSenderId: "8252614455", // <--- REEMPLAZA
    appId: "1:8252614455:web:d5917541790006a6e09cb2 ", // <--- REEMPLAZA (opcional si no usas Analytics)
};

// 3. Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referencias a colecciones de Firestore
const parqueadosRef = collection(db, "parqueados_actualmente");
const historialRef = collection(db, "historial_parqueos");
const mensualidadesRef = collection(db, "mensualidades");
const tarifasDocRef = doc(db, "configuracion", "tarifas"); // Un solo documento para tarifas

// Variables globales para tarifas (se cargarán de Firebase)
let tarifas = {
    moto: 0.01,
    automovil: 0.02,
    camion: 0.03,
    tarifaPlanaHoras: 12, // Horas para aplicar tarifa plana
    tarifaPlanaValor: 20000 // Valor de la tarifa plana
};

// --- Elementos del DOM ---
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const clientPanel = document.getElementById('client-panel');
const loginBtn = document.getElementById('login-btn');
const logoutBtnAdmin = document.getElementById('logout-btn-admin');
const logoutBtnClient = document.getElementById('logout-btn-client');
const loginMessage = document.getElementById('login-message');

// Admin Panel Elements
const entradaPlacaInput = document.getElementById('entrada-placa');
const entradaTipoVehiculoSelect = document.getElementById('entrada-tipo-vehiculo');
const registrarEntradaBtn = document.getElementById('registrar-entrada-btn');
const entradaMessage = document.getElementById('entrada-message');

const salidaPlacaInput = document.getElementById('salida-placa');
const registrarSalidaBtn = document.getElementById('registrar-salida-btn');
const salidaInfo = document.getElementById('salida-info');
const generarComprobanteBtn = document.getElementById('generar-comprobante-btn');

const motosCount = document.getElementById('motos-count');
const autosCount = document.getElementById('autos-count');
const camionesCount = document.getElementById('camiones-count');
const parqueadosTableBody = document.querySelector('#parqueados-table tbody');
const historialTableBody = document.querySelector('#historial-table tbody');

const mensualidadPlacaInput = document.getElementById('mensualidad-placa');
const mensualidadTipoVehiculoSelect = document.getElementById('mensualidad-tipo-vehiculo');
const mensualidadNombrePagaInput = document.getElementById('mensualidad-nombre-paga'); // NUEVO
const mensualidadValorInput = document.getElementById('mensualidad-valor');           // NUEVO
const mensualidadFechaPagoInput = document.getElementById('mensualidad-fecha-pago'); // NUEVO
const mensualidadFechaInicioInput = document.getElementById('mensualidad-fecha-inicio');
const mensualidadFechaFinInput = document.getElementById('mensualidad-fecha-fin');
const registrarMensualidadBtn = document.getElementById('registrar-mensualidad-btn');
const mensualidadMessage = document.getElementById('mensualidad-message');
const mensualidadesTableBody = document.querySelector('#mensualidades-table tbody');
const exportarMensualidadesBtn = document.getElementById('exportar-mensualidades-btn');

const tarifaMotoSegundoInput = document.getElementById('tarifa-moto-segundo');
const tarifaAutoSegundoInput = document.getElementById('tarifa-auto-segundo');
const tarifaCamionSegundoInput = document.getElementById('tarifa-camion-segundo');
const tarifaPlanaHorasInput = document.getElementById('tarifa-plana-horas');
const tarifaPlanaValorInput = document.getElementById('tarifa-plana-valor');
const guardarTarifasBtn = document.getElementById('guardar-tarifas-btn');
const tarifasMessage = document.getElementById('tarifas-message');

const buscarClientePlacaInput = document.getElementById('buscar-cliente-placa');
const buscarClienteBtn = document.getElementById('buscar-cliente-btn');
const clienteInfoDiv = document.getElementById('cliente-info');
const clienteInfoPlaca = document.getElementById('cliente-info-placa');
const clienteInfoPass = document.getElementById('cliente-info-pass');
const resetPassBtn = document.getElementById('reset-pass-btn');
const clienteGestionMessage = document.getElementById('cliente-gestion-message');

// Client Panel Elements
const clientMensualidadesTableBody = document.querySelector('#client-mensualidades-table tbody');
const clientMensualidadesMessage = document.getElementById('client-mensualidades-message');

// --- Variables de Estado ---
let currentUserRole = null; // 'admin' o 'cliente'
let currentClientPlaca = null; // Placa del cliente logueado
let lastParkedVehicleOut = null; // Guarda el último vehículo del que se registró la salida para el comprobante (Admin)

// --- Funciones de Utilidad ---

function showMessage(element, msg, isSuccess = true) {
    element.textContent = msg;
    element.className = `message ${isSuccess ? 'success-message' : 'error-message'}`;
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 5000);
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    // Si es un objeto Timestamp de Firebase
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString(); // Formato legible de fecha y hora
}

function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

function calculateCost(durationMs, tipoVehiculo) {
    const totalSeconds = durationMs / 1000;
    let costPerSecond;

    switch (tipoVehiculo) {
        case 'moto':
            costPerSecond = tarifas.moto;
            break;
        case 'automovil':
            costPerSecond = tarifas.automovil;
            break;
        case 'camion':
            costPerSecond = tarifas.camion;
            break;
        default:
            return 0;
    }

    let calculatedCost = totalSeconds * costPerSecond;

    // Aplicar tarifa plana si excede las horas configuradas
    if (totalSeconds >= (tarifas.tarifaPlanaHoras * 3600)) {
        return tarifas.tarifaPlanaValor;
    }

    return parseFloat(calculatedCost.toFixed(2)); // Redondear a 2 decimales
}

async function loadTarifas() {
    try {
        const docSnap = await getDocs(collection(db, "configuracion"));
        if (!docSnap.empty) {
            docSnap.forEach(doc => {
                if(doc.id === "tarifas") { // Asegurarse de que es el documento de tarifas
                    // Asegurarse de cargar solo las tarifas relevantes
                    tarifas.moto = doc.data().moto || 0.01;
                    tarifas.automovil = doc.data().automovil || 0.02;
                    tarifas.camion = doc.data().camion || 0.03;
                    tarifas.tarifaPlanaHoras = doc.data().tarifaPlanaHoras || 12;
                    tarifas.tarifaPlanaValor = doc.data().tarifaPlanaValor || 20000;
                }
            });
            // Cargar en los inputs del admin
            tarifaMotoSegundoInput.value = tarifas.moto;
            tarifaAutoSegundoInput.value = tarifas.automovil;
            tarifaCamionSegundoInput.value = tarifas.camion;
            tarifaPlanaHorasInput.value = tarifas.tarifaPlanaHoras;
            tarifaPlanaValorInput.value = tarifas.tarifaPlanaValor;
        } else {
            // Si no hay tarifas, guardamos las predeterminadas
            await setDoc(tarifasDocRef, tarifas);
        }
    } catch (e) {
        console.error("Error al cargar tarifas:", e);
        showMessage(tarifasMessage, "Error al cargar tarifas.", false);
    }
}


// --- Autenticación ---

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (username === 'admin' && password === 'Martin120619') {
        currentUserRole = 'admin';
        loginSection.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        clientPanel.classList.add('hidden');
        loginMessage.textContent = '';
        await loadAdminDashboard();
    } else {
        // Intentar iniciar sesión como cliente (placa = usuario y contraseña)
        if (username === password && username !== '') {
            // Check if client exists in mensualidades (only check this now)
            const qMensualidades = query(mensualidadesRef, where("placa", "==", username.toUpperCase()));
            const querySnapshotMensualidades = await getDocs(qMensualidades);

            if (!querySnapshotMensualidades.empty) {
                currentUserRole = 'cliente';
                currentClientPlaca = username.toUpperCase();
                loginSection.classList.add('hidden');
                adminPanel.classList.add('hidden');
                clientPanel.classList.remove('hidden');
                loginMessage.textContent = '';
                await loadClientDashboard();
            } else {
                showMessage(loginMessage, 'Usuario o contraseña incorrectos.', false);
            }
        } else {
            showMessage(loginMessage, 'Usuario o contraseña incorrectos.', false);
        }
    }
}

function logout() {
    currentUserRole = null;
    currentClientPlaca = null;
    loginSection.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    clientPanel.classList.add('hidden');
    loginMessage.textContent = '';
    // Limpiar campos de login
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// --- Gestión de Parqueo por Horas (Admin) ---

async function registrarEntrada() {
    const placa = entradaPlacaInput.value.trim().toUpperCase();
    const tipoVehiculo = entradaTipoVehiculoSelect.value;

    if (!placa) {
        showMessage(entradaMessage, 'La placa no puede estar vacía.', false);
        return;
    }

    // Verificar si el vehículo ya está parqueado
    const q = query(parqueadosRef, where("placa", "==", placa));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        showMessage(entradaMessage, `El vehículo con placa ${placa} ya está parqueado.`, false);
        return;
    }

    try {
        await addDoc(parqueadosRef, {
            placa,
            tipoVehiculo,
            horaEntrada: new Date()
        });
        showMessage(entradaMessage, `Entrada registrada para ${placa}.`, true);
        entradaPlacaInput.value = '';
        await loadParqueados();
    } catch (e) {
        console.error("Error al registrar entrada:", e);
        showMessage(entradaMessage, `Error al registrar entrada: ${e.message}`, false);
    }
}

async function registrarSalida() {
    const placa = salidaPlacaInput.value.trim().toUpperCase();
    if (!placa) {
        showMessage(salidaInfo, 'La placa no puede estar vacía.', false);
        return;
    }

    const q = query(parqueadosRef, where("placa", "==", placa));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        showMessage(salidaInfo, `Vehículo con placa ${placa} no encontrado en el parqueadero.`, false);
        generarComprobanteBtn.classList.add('hidden');
        return;
    }

    const docToUpdate = querySnapshot.docs[0];
    const parqueoData = docToUpdate.data();
    const horaSalida = new Date();
    const horaEntradaMs = parqueoData.horaEntrada.toDate().getTime();
    const duracionMs = horaSalida.getTime() - horaEntradaMs;
    const costo = calculateCost(duracionMs, parqueoData.tipoVehiculo);

    try {
        // Mover a historial y eliminar de parqueados_actualmente
        await addDoc(historialRef, {
            ...parqueoData,
            horaSalida: horaSalida,
            duracionMs: duracionMs,
            costo: costo
        });
        await deleteDoc(doc(db, "parqueados_actualmente", docToUpdate.id));

        lastParkedVehicleOut = { // Guardar para el comprobante (raw data)
            placa: parqueoData.placa,
            tipoVehiculo: parqueoData.tipoVehiculo,
            horaEntrada: parqueoData.horaEntrada, // Keep as Timestamp for consistency
            horaSalida: horaSalida, // Keep as Date object for consistency
            duracionMs: duracionMs,
            costo: costo
        };

        showMessage(salidaInfo, `Salida registrada para ${placa}. Duración: ${formatDuration(duracionMs)}, Costo: ${costo.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`, true);
        generarComprobanteBtn.classList.remove('hidden');
        salidaPlacaInput.value = '';
        await loadParqueados();
        await loadHistorialParqueos();
    } catch (e) {
        console.error("Error al registrar salida:", e);
        showMessage(salidaInfo, `Error al registrar salida: ${e.message}`, false);
        generarComprobanteBtn.classList.add('hidden');
    }
}

async function loadParqueados() {
    const querySnapshot = await getDocs(parqueadosRef);
    parqueadosTableBody.innerHTML = '';
    let motos = 0, autos = 0, camiones = 0;

    querySnapshot.forEach(doc => {
        const data = doc.data();
        const row = parqueadosTableBody.insertRow();
        row.innerHTML = `
            <td>${data.placa}</td>
            <td>${data.tipoVehiculo}</td>
            <td>${formatDate(data.horaEntrada)}</td>
            <td><button class="small-btn" data-action="salida" data-placa="${data.placa}">Salir</button></td>
        `;
        row.querySelector('[data-action="salida"]').addEventListener('click', () => {
            salidaPlacaInput.value = data.placa;
            registrarSalida();
        });

        if (data.tipoVehiculo === 'moto') motos++;
        else if (data.tipoVehiculo === 'automovil') autos++;
        else if (data.tipoVehiculo === 'camion') camiones++;
    });

    motosCount.textContent = motos;
    autosCount.textContent = autos;
    camionesCount.textContent = camiones;
}

async function loadHistorialParqueos() {
    const querySnapshot = await getDocs(historialRef);
    historialTableBody.innerHTML = '';

    querySnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const docId = docSnapshot.id;
        const row = historialTableBody.insertRow();
        row.innerHTML = `
            <td>${data.placa}</td>
            <td>${data.tipoVehiculo}</td>
            <td>${formatDate(data.horaEntrada)}</td>
            <td>${formatDate(data.horaSalida)}</td>
            <td>${formatDuration(data.duracionMs)}</td>
            <td>${data.costo ? data.costo.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : 'N/A'}</td>
            <td>
                <button class="small-btn" data-action="edit-historial" data-id="${docId}">Editar</button>
                <button class="small-btn delete-btn" data-action="delete-historial" data-id="${docId}">Eliminar</button>
                <button class="small-btn download-comprobante-btn" data-action="download-historial" data-doc-id="${docId}">Descargar Comprobante</button>
            </td>
        `;

        row.querySelector('[data-action="edit-historial"]').addEventListener('click', () => editHistorial(docId, data));
        row.querySelector('[data-action="delete-historial"]').addEventListener('click', () => deleteHistorial(docId));
        row.querySelector('[data-action="download-historial"]').addEventListener('click', () => generarComprobante(data)); // Pass data directly
    });
}

async function editHistorial(docId, data) {
    const newEntradaStr = prompt('Ingrese nueva Hora de Entrada (YYYY-MM-DD HH:MM:SS):', formatDate(data.horaEntrada));
    const newSalidaStr = prompt('Ingrese nueva Hora de Salida (YYYY-MM-DD HH:MM:SS):', formatDate(data.horaSalida));

    if (!newEntradaStr || !newSalidaStr) return;

    const newEntrada = new Date(newEntradaStr);
    const newSalida = new Date(newSalidaStr);

    if (isNaN(newEntrada.getTime()) || isNaN(newSalida.getTime())) {
        alert('Fechas inválidas. Use el formato YYYY-MM-DD HH:MM:SS');
        return;
    }

    const newDurationMs = newSalida.getTime() - newEntrada.getTime();
    if (newDurationMs < 0) {
        alert('La hora de salida no puede ser anterior a la hora de entrada.');
        return;
    }
    const newCost = calculateCost(newDurationMs, data.tipoVehiculo);

    try {
        await updateDoc(doc(db, "historial_parqueos", docId), {
            horaEntrada: newEntrada,
            horaSalida: newSalida,
            duracionMs: newDurationMs,
            costo: newCost
        });
        showMessage(salidaInfo, `Historial actualizado para ${data.placa}.`, true);
        await loadHistorialParqueos();
    } catch (e) {
        console.error("Error al actualizar historial:", e);
        showMessage(salidaInfo, `Error al actualizar historial: ${e.message}`, false);
    }
}

async function deleteHistorial(docId) {
    if (confirm('¿Está seguro de que desea eliminar este registro del historial?')) {
        try {
            await deleteDoc(doc(db, "historial_parqueos", docId));
            showMessage(salidaInfo, `Registro de historial eliminado.`, true);
            await loadHistorialParqueos();
        } catch (e) {
            console.error("Error al eliminar historial:", e);
            showMessage(salidaInfo, `Error al eliminar historial: ${e.message}`, false);
        }
    }
}

// Modified generarComprobante to accept data dynamically for hourly parking
function generarComprobante(parkData) {
    if (!parkData) {
        showMessage(salidaInfo, "No hay datos de parqueo para generar comprobante.", false);
        return;
    }

    const doc = new jsPDF();

    // Format data for PDF
    const placa = parkData.placa;
    const tipo = parkData.tipoVehiculo;
    const entrada = formatDate(parkData.horaEntrada);
    const salida = formatDate(parkData.horaSalida);
    const duracion = formatDuration(parkData.duracionMs);
    const costo = parkData.costo.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });


    doc.setFontSize(22);
    doc.text("Comprobante de Parqueo PPPB", 105, 20, null, null, "center");

    doc.setFontSize(12);
    doc.text(`Fecha y Hora de Impresión: ${new Date().toLocaleString()}`, 105, 30, null, null, "center");

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(20, 40, 190, 40); // Línea divisoria

    doc.setFontSize(14);
    doc.text("Detalles del Parqueo:", 20, 50);

    doc.setFontSize(12);
    doc.text(`Placa: ${placa}`, 20, 60);
    doc.text(`Tipo de Vehículo: ${tipo}`, 20, 67);
    doc.text(`Hora de Entrada: ${entrada}`, 20, 74);
    doc.text(`Hora de Salida: ${salida}`, 20, 81);
    doc.text(`Duración: ${duracion}`, 20, 88);

    doc.setFontSize(16);
    doc.text(`Costo Total: ${costo}`, 20, 100);

    doc.save(`Comprobante_Parqueo_${placa}.pdf`);
    showMessage(salidaInfo, "Comprobante generado con éxito.", true);
}


// --- Gestión de Mensualidades (Admin) --- [FUNCIÓN CORREGIDA]

async function registrarMensualidad() {
    const placa = mensualidadPlacaInput.value.trim().toUpperCase();
    const tipoVehiculo = mensualidadTipoVehiculoSelect.value;
    const nombrePaga = mensualidadNombrePagaInput.value.trim();
    const valorMensualidad = parseFloat(mensualidadValorInput.value);
    const fechaPagoStr = mensualidadFechaPagoInput.value;
    const fechaInicioStr = mensualidadFechaInicioInput.value;
    const fechaFinStr = mensualidadFechaFinInput.value;

    if (!placa || !nombrePaga || isNaN(valorMensualidad) || valorMensualidad <= 0 || !fechaInicioStr || !fechaFinStr) {
        showMessage(mensualidadMessage, 'Todos los campos (Placa, Pagador, Valor, Fecha Inicio, Fecha Fin) son obligatorios y el valor debe ser positivo.', false);
        return;
    }

    const fechaInicio = new Date(fechaInicioStr + 'T00:00:00');
    const fechaFin = new Date(fechaFinStr + 'T23:59:59');
    const fechaPago = fechaPagoStr ? new Date(fechaPagoStr + 'T12:00:00') : new Date();

    if (fechaInicio.getTime() >= fechaFin.getTime()) {
        showMessage(mensualidadMessage, 'La fecha de fin debe ser posterior a la fecha de inicio.', false);
        return;
    }

    // Verificar solapamiento solo con mensualidades ACTIVAS (no vencidas)
    const q = query(mensualidadesRef, where("placa", "==", placa));
    const querySnapshot = await getDocs(q);
    let solapamientoEncontrado = false;
    const fechaActual = new Date();
    // Resetear la fecha actual para comparar solo fechas (sin horas)
    fechaActual.setHours(0, 0, 0, 0);

    console.log('=== VERIFICACIÓN DE SOLAPAMIENTO ===');
    console.log('Fecha actual (sin horas):', fechaActual);
    console.log('Nueva mensualidad - Inicio:', fechaInicio);
    console.log('Nueva mensualidad - Fin:', fechaFin);

    querySnapshot.forEach(doc => {
        const data = doc.data();
        const existingInicio = data.fechaInicio.toDate();
        const existingFin = data.fechaFin.toDate();
        
        // Resetear las horas para comparar solo fechas
        existingInicio.setHours(0, 0, 0, 0);
        existingFin.setHours(23, 59, 59, 999);

        console.log('---');
        console.log('Mensualidad existente - Inicio:', existingInicio);
        console.log('Mensualidad existente - Fin:', existingFin);
        console.log('¿Está vencida?', existingFin < fechaActual);
        
        // Solo verificar solapamiento si la mensualidad NO está vencida
        if (existingFin >= fechaActual) {
            console.log('-> Mensualidad ACTIVA encontrada, verificando solapamiento...');
            
            // Resetear las fechas nuevas para comparación
            const nuevaInicio = new Date(fechaInicio);
            const nuevaFin = new Date(fechaFin);
            nuevaInicio.setHours(0, 0, 0, 0);
            nuevaFin.setHours(23, 59, 59, 999);
            
            console.log('Comparando:');
            console.log('  Nueva inicio <= Existente fin?', nuevaInicio <= existingFin, `(${nuevaInicio} <= ${existingFin})`);
            console.log('  Nueva fin >= Existente inicio?', nuevaFin >= existingInicio, `(${nuevaFin} >= ${existingInicio})`);
            
            // Check for overlap: (StartA <= EndB) and (EndA >= StartB)
            if (nuevaInicio <= existingFin && nuevaFin >= existingInicio) {
                console.log('-> ¡SOLAPAMIENTO ENCONTRADO!');
                solapamientoEncontrado = true;
            } else {
                console.log('-> No hay solapamiento');
            }
        } else {
            console.log('-> Mensualidad VENCIDA, se ignora para verificación');
        }
    });

    console.log('=== FIN VERIFICACIÓN ===');

    if (solapamientoEncontrado) {
        showMessage(mensualidadMessage, `Ya existe una mensualidad ACTIVA para la placa ${placa} en el período seleccionado.`, false);
        return;
    }

    try {
        await addDoc(mensualidadesRef, {
            placa,
            tipoVehiculo,
            nombrePersonaPaga: nombrePaga,
            valorMensualidad: valorMensualidad,
            fechaInicio,
            fechaFin,
            fechaPago: fechaPago
        });
        showMessage(mensualidadMessage, `Mensualidad registrada para ${placa}.`, true);
        mensualidadPlacaInput.value = '';
        mensualidadNombrePagaInput.value = '';
        mensualidadValorInput.value = '';
        mensualidadFechaPagoInput.value = '';
        mensualidadFechaInicioInput.value = '';
        mensualidadFechaFinInput.value = '';
        await loadMensualidades();
        // If client is logged in and it's their placa, refresh their mensualidades view
        if (currentUserRole === 'cliente' && currentClientPlaca === placa) {
            await loadClientMensualidades(currentClientPlaca);
        }
    } catch (e) {
        console.error("Error al registrar mensualidad:", e);
        showMessage(mensualidadMessage, `Error al registrar mensualidad: ${e.message}`, false);
    }
}

async function loadMensualidades() {
    const querySnapshot = await getDocs(mensualidadesRef);
    mensualidadesTableBody.innerHTML = '';

    querySnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const docId = docSnapshot.id;
        const now = new Date();
        const inicio = data.fechaInicio.toDate();
        const fin = data.fechaFin.toDate();
        let estado = 'Activa';
        if (now < inicio) {
            estado = 'Pendiente';
        } else if (now > fin) {
            estado = 'Vencida';
        }
        const fechaPagoDisplay = data.fechaPago ? data.fechaPago.toDate().toLocaleDateString('es-CO') : 'N/A'; // Formato de fecha local
        const nombrePagaDisplay = data.nombrePersonaPaga || 'N/A';
        const valorMensualidadDisplay = data.valor

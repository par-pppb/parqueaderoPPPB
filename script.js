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


// --- Gestión de Mensualidades (Admin) ---

async function registrarMensualidad() {
    const placa = mensualidadPlacaInput.value.trim().toUpperCase();
    const tipoVehiculo = mensualidadTipoVehiculoSelect.value;
    const nombrePaga = mensualidadNombrePagaInput.value.trim();         // NUEVO
    const valorMensualidad = parseFloat(mensualidadValorInput.value);   // NUEVO
    const fechaPagoStr = mensualidadFechaPagoInput.value;               // NUEVO
    const fechaInicioStr = mensualidadFechaInicioInput.value;
    const fechaFinStr = mensualidadFechaFinInput.value;

    if (!placa || !nombrePaga || isNaN(valorMensualidad) || valorMensualidad <= 0 || !fechaInicioStr || !fechaFinStr) {
        showMessage(mensualidadMessage, 'Todos los campos (Placa, Pagador, Valor, Fecha Inicio, Fecha Fin) son obligatorios y el valor debe ser positivo.', false);
        return;
    }

    const fechaInicio = new Date(fechaInicioStr + 'T00:00:00'); // Asegurar UTC para comparación
    const fechaFin = new Date(fechaFinStr + 'T23:59:59');     // Asegurar UTC para comparación
    const fechaPago = fechaPagoStr ? new Date(fechaPagoStr + 'T12:00:00') : new Date(); // Si no se ingresa, usa la fecha actual

    if (fechaInicio.getTime() >= fechaFin.getTime()) {
        showMessage(mensualidadMessage, 'La fecha de fin debe ser posterior a la fecha de inicio.', false);
        return;
    }

    // Verificar solapamiento de fechas (solo con mensualidades activas)
const q = query(mensualidadesRef, where("placa", "==", placa));
const querySnapshot = await getDocs(q);
let solapamientoEncontrado = false;
const fechaActual = new Date();

querySnapshot.forEach(doc => {
    const data = doc.data();
    const existingInicio = data.fechaInicio.toDate();
    const existingFin = data.fechaFin.toDate();

    // Solo verificar solapamiento si la mensualidad existente no ha vencido
    // (es decir, si la fecha de fin es posterior a la fecha actual)
    if (existingFin >= fechaActual) {
        // Check for overlap: (StartA <= EndB) and (EndA >= StartB)
        if (fechaInicio <= existingFin && fechaFin >= existingInicio) {
            solapamientoEncontrado = true;
        }
    }
});

    if (solapamientoEncontrado) {
        showMessage(mensualidadMessage, `Ya existe una mensualidad activa o solapada para la placa ${placa} en el período seleccionado.`, false);
        return;
    }

    try {
        await addDoc(mensualidadesRef, {
            placa,
            tipoVehiculo,
            nombrePersonaPaga: nombrePaga,    // NUEVO
            valorMensualidad: valorMensualidad, // NUEVO
            fechaInicio,
            fechaFin,
            fechaPago: fechaPago              // NUEVO: Usar la fecha ingresada o la actual
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
        const valorMensualidadDisplay = data.valorMensualidad ? data.valorMensualidad.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : 'N/A';


        const row = mensualidadesTableBody.insertRow();
        row.innerHTML = `
            <td>${data.placa}</td>
            <td>${data.tipoVehiculo}</td>
            <td>${nombrePagaDisplay}</td>
            <td>${valorMensualidadDisplay}</td>
            <td>${inicio.toLocaleDateString('es-CO')}</td>
            <td>${fin.toLocaleDateString('es-CO')}</td>
            <td>${fechaPagoDisplay}</td>
            <td><span class="status-${estado.toLowerCase()}">${estado}</span></td>
            <td>
                <button class="small-btn delete-btn" data-action="delete-mensualidad" data-id="${docId}">Eliminar</button>
            </td>
        `;
        row.querySelector('[data-action="delete-mensualidad"]').addEventListener('click', () => deleteMensualidad(docId));
    });
}

async function deleteMensualidad(docId) {
    if (confirm('¿Está seguro de que desea eliminar esta mensualidad?')) {
        try {
            await deleteDoc(doc(db, "mensualidades", docId));
            showMessage(mensualidadMessage, `Mensualidad eliminada.`, true);
            await loadMensualidades();
            if (currentUserRole === 'cliente') {
                await loadClientMensualidades(currentClientPlaca);
            }
        } catch (e) {
            console.error("Error al eliminar mensualidad:", e);
            showMessage(mensualidadMessage, `Error al eliminar mensualidad: ${e.message}`, false);
        }
    }
}

function exportarMensualidadesToExcel() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Placa,Tipo,Pagador,Valor,Fecha Inicio,Fecha Fin,Fecha de Pago,Estado\n";

    const rows = mensualidadesTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length > 0) {
            const placa = cols[0].textContent;
            const tipo = cols[1].textContent;
            const pagador = cols[2].textContent;
            const valor = cols[3].textContent;
            const inicio = cols[4].textContent;
            const fin = cols[5].textContent;
            const fechaPago = cols[6].textContent;
            const estado = cols[7].textContent;
            csvContent += `${placa},${tipo},${pagador},${valor},${inicio},${fin},${fechaPago},${estado}\n`;
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mensualidades_parqueadero.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage(mensualidadMessage, "Datos de mensualidades exportados a Excel (CSV).", true);
}


// --- Configuración y Administración (Admin) ---

async function guardarTarifas() {
    const newTarifas = {
        moto: parseFloat(tarifaMotoSegundoInput.value),
        automovil: parseFloat(tarifaAutoSegundoInput.value),
        camion: parseFloat(tarifaCamionSegundoInput.value),
        tarifaPlanaHoras: parseFloat(tarifaPlanaHorasInput.value),
        tarifaPlanaValor: parseFloat(tarifaPlanaValorInput.value)
    };

    if (Object.values(newTarifas).some(isNaN) || Object.values(newTarifas).some(val => val < 0)) {
        showMessage(tarifasMessage, "Por favor, ingrese valores numéricos válidos y positivos para las tarifas.", false);
        return;
    }

    try {
        await setDoc(tarifasDocRef, newTarifas); // Usar setDoc para sobrescribir completamente
        tarifas = newTarifas; // Actualizar la variable global
        showMessage(tarifasMessage, "Tarifas guardadas con éxito.", true);
    } catch (e) {
        console.error("Error al guardar tarifas:", e);
        showMessage(tarifasMessage, `Error al guardar tarifas: ${e.message}`, false);
    }
}

async function buscarCliente() {
    const placaBuscar = buscarClientePlacaInput.value.trim().toUpperCase();
    if (!placaBuscar) {
        showMessage(clienteGestionMessage, 'Ingrese una placa para buscar.', false);
        clienteInfoDiv.classList.add('hidden');
        return;
    }

    // Buscar solo en mensualidades para determinar si es un cliente (ya que historial ya no se usa para cliente login)
    const qMensualidades = query(mensualidadesRef, where("placa", "==", placaBuscar));
    const querySnapshotMensualidades = await getDocs(qMensualidades);

    if (!querySnapshotMensualidades.empty) {
        // We can show the placa, but the password is the placa itself, so no actual "client" document exists in DB for password
        clienteInfoPlaca.textContent = placaBuscar;
        clienteInfoPass.textContent = placaBuscar; // La contraseña es la misma placa
        clienteInfoDiv.classList.remove('hidden');
        showMessage(clienteGestionMessage, `Cliente ${placaBuscar} encontrado.`, true);
    } else {
        clienteInfoDiv.classList.add('hidden');
        showMessage(clienteGestionMessage, `Cliente con placa ${placaBuscar} no encontrado.`, false);
    }
}

function resetearContrasenaCliente() {
    const placaCliente = clienteInfoPlaca.textContent;
    if (placaCliente && confirm(`¿Está seguro de restablecer la contraseña del cliente ${placaCliente} a su misma placa?`)) {
        // En este modelo, la contraseña es la misma placa, así que no hay una operación de "reset" en Firebase Auth.
        // La acción aquí es más bien para "recordarle" al admin cuál es la contraseña.
        showMessage(clienteGestionMessage, `Contraseña de ${placaCliente} restablecida (ahora es su misma placa).`, true);
    }
}

// --- Panel de Cliente ---

async function loadClientMensualidades(placa) {
    const q = query(mensualidadesRef, where("placa", "==", placa));
    const querySnapshot = await getDocs(q);
    clientMensualidadesTableBody.innerHTML = '';

    if (querySnapshot.empty) {
        clientMensualidadesMessage.textContent = "No tienes mensualidades registradas.";
        return;
    } else {
        clientMensualidadesMessage.textContent = "";
    }

    querySnapshot.forEach(doc => {
        const data = doc.data();
        const now = new Date();
        const inicio = data.fechaInicio.toDate();
        const fin = data.fechaFin.toDate();
        let estado = 'Activa';
        if (now < inicio) {
            estado = 'Pendiente';
        } else if (now > fin) {
            estado = 'Vencida';
        }
        const fechaPagoDisplay = data.fechaPago ? data.fechaPago.toDate().toLocaleDateString('es-CO') : 'N/A';
        const nombrePagaDisplay = data.nombrePersonaPaga || 'N/A';
        const valorMensualidadDisplay = data.valorMensualidad ? data.valorMensualidad.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : 'N/A';


        const row = clientMensualidadesTableBody.insertRow();
        row.innerHTML = `
            <td>${data.placa}</td>
            <td>${data.tipoVehiculo}</td>
            <td>${nombrePagaDisplay}</td>
            <td>${valorMensualidadDisplay}</td>
            <td>${inicio.toLocaleDateString('es-CO')}</td>
            <td>${fin.toLocaleDateString('es-CO')}</td>
            <td>${fechaPagoDisplay}</td>
            <td><span class="status-${estado.toLowerCase()}">${estado}</span></td>
            <td>
                <button class="small-btn download-mensualidad-btn" data-doc-id="${doc.id}">Descargar Comprobante</button>
            </td>
        `;
        // Attach event listener to the download button for mensualidad
        row.querySelector('.download-mensualidad-btn').addEventListener('click', () => generarComprobanteMensualidad(data));
    });
}

// New function to generate PDF for mensualidad with the new design
function generarComprobanteMensualidad(mensualidadData) {
    if (!mensualidadData) {
        console.error("No hay datos de mensualidad para generar comprobante.");
        return;
    }

    const doc = new jsPDF();

    // --- LOGO Y FIRMA EN BASE64 ---
    // Reemplaza 'LOGO_BASE64_AQUI' con tu imagen de logo en Base64
    const logoBase64 = 'data:image/png;base64,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';
    // Reemplaza 'FIRMA_BASE64_AQUI' con tu imagen de firma en Base64
    const firmaBase64 = 'data:image/png;base64,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';

    // Coordenadas y dimensiones (ajusta según tus necesidades)
    const logoX = 85;
    const logoY = 10;
    const logoWidth = 40;
    const logoHeight = 40;

    const firmaX = 75;
    const firmaY = 195;
    const firmaWidth = 60;
    const firmaHeight = 20;

    // Agregar logo si existe
    if (logoBase64 !== 'LOGO_BASE64_AQUI') {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
    }
    // Agregar firma si existe
    if (firmaBase64 !== 'FIRMA_BASE64_AQUI') {
        doc.addImage(firmaBase64, 'PNG', firmaX, firmaY, firmaWidth, firmaHeight);
    }


    // Formato de datos
    const placa = mensualidadData.placa;
    const nombrePaga = mensualidadData.nombrePersonaPaga || 'N/A';
    const valor = mensualidadData.valorMensualidad ? mensualidadData.valorMensualidad.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) : 'N/A';
    const valorEnLetras = numToWords(mensualidadData.valorMensualidad || 0); // Convertir valor a letras
    const fechaPago = mensualidadData.fechaPago ? mensualidadData.fechaPago.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase() : 'N/A';
    const inicioPeriodo = mensualidadData.fechaInicio.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    const finPeriodo = mensualidadData.fechaFin.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    const ciudadFechaActual = `Bogotá, ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}`;

    // Título y detalles principales
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text("PARQUEADERO PPPB", 105, 60, null, null, "center");
    doc.setFontSize(15);
    doc.text("COMPROBANTE DE PAGO - RECIBO DE ARRENDAMIENTO", 105, 70, null, null, "center");

    let currentY = 85; // Starting Y coordinate for the first line of content
    const lineHeight = 7; // Standard line height for details

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal'); // Ensure normal font for calculations

    // Fecha de Pago:
    doc.setFont('helvetica', 'bold');
    doc.text(`Fecha de Pago: `, 20, currentY);
    const fechaPagoLabelWidth = doc.getTextWidth('Fecha de Pago: ');
    doc.setFont('helvetica', 'normal');
    doc.text(`${fechaPago}`, 20 + fechaPagoLabelWidth, currentY);
    currentY += lineHeight;

    // Recibimos de:
    doc.setFont('helvetica', 'bold');
    doc.text(`Recibimos de: `, 20, currentY);
    const recibimosDeLabelWidth = doc.getTextWidth('Recibimos de: ');
    doc.setFont('helvetica', 'normal');
    doc.text(`${nombrePaga}`, 20 + recibimosDeLabelWidth, currentY);
    currentY += lineHeight;

    // Placa:
    doc.setFont('helvetica', 'bold');
    doc.text(`Placa: `, 20, currentY);
    const placaLabelWidth = doc.getTextWidth('Placa: ');
    doc.setFont('helvetica', 'normal');
    doc.text(`${placa}`, 20 + placaLabelWidth, currentY);
    currentY += lineHeight * 2; // Add extra space before sum

    // LA SUMA DE:
    doc.setFontSize(14); // Larger font for sum
    doc.setFont('helvetica', 'bold');
    doc.text(`LA SUMA DE: `, 20, currentY);
    const laSumaDeLabelWidth = doc.getTextWidth('LA SUMA DE: ');
    doc.setFont('helvetica', 'normal');
    doc.text(`${valor}`, 20 + laSumaDeLabelWidth, currentY);
    currentY += lineHeight;

    // Valor en letras (not bolded, but follows the pattern)
    doc.setFontSize(10); // Smaller font for value in words
    doc.setFont('helvetica', 'normal');
    doc.text(`(${valorEnLetras} M/CTE)`, 20, currentY);
    currentY += lineHeight * 2; // Add extra space before concept

    // Por Concepto de:
    doc.setFontSize(12); // Back to normal size for concept
    doc.setFont('helvetica', 'bold');
    doc.text(`Por Concepto de: `, 20, currentY);
    const porConceptoDeLabelWidth = doc.getTextWidth('Por Concepto de: ');
    doc.setFont('helvetica', 'normal');
    doc.text(`Arriendo parqueadero`, 20 + porConceptoDeLabelWidth, currentY);
    currentY += lineHeight;

    // Correspondiente al período:
    doc.setFont('helvetica', 'bold');
    doc.text(`Correspondiente al período: `, 20, currentY);
    const correspondienteAlPeriodoLabelWidth = doc.getTextWidth('Correspondiente al período: ');
    doc.setFont('helvetica', 'normal');
    doc.text(`Del ${inicioPeriodo} Al ${finPeriodo}`, 20 + correspondienteAlPeriodoLabelWidth, currentY);
    currentY += lineHeight * 2; // Add extra space before signature line

    // Línea para la firma
    doc.line(70, 215, 140, 215); // x1, y1, x2, y2
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal'); // Ensure normal for this text
    doc.text("Firma Recibido", 105, 220, null, null, "center");
    doc.text("Gracias por su pago!", 105, 290, null, null, "center");

    doc.save(`Comprobante_Mensualidad_${placa}.pdf`);
}

// Función para convertir número a letras (simplificada para pesos colombianos)
// Esta es una implementación básica. Para un uso más robusto, considera una librería.
function numToWords(num) {
    const units = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVECIENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function convertGroup(n) {
        let s = '';
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (h > 0) {
            if (h === 1 && t === 0 && u === 0) {
                s += 'CIEN ';
            } else {
                s += hundreds[h] + ' ';
            }
        }

        if (t === 1) {
            s += teens[u] + ' ';
        } else if (t > 1) {
            s += tens[t] + ' ';
            if (u > 0) s += 'Y ' + units[u] + ' ';
        } else if (u > 0) {
            s += units[u] + ' ';
        }
        return s;
    }

    num = Math.floor(num); // Solo la parte entera para los pesos
    if (num === 0) return 'CERO PESOS';

    let s = '';
    const millions = Math.floor(num / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const unitsPart = num % 1000;

    if (millions > 0) {
        s += convertGroup(millions) + (millions === 1 ? 'MILLON ' : 'MILLONES ');
    }

    if (thousands > 0) {
        s += convertGroup(thousands) + 'MIL ';
    }

    if (unitsPart > 0) {
        s += convertGroup(unitsPart);
    }
    
    return s.trim() + ' PESOS'; // Añadido espacio antes de 'PESOS'
}


// --- Carga Inicial del Dashboard ---
async function loadAdminDashboard() {
    await loadTarifas();
    await loadParqueados();
    await loadHistorialParqueos();
    await loadMensualidades();
}

async function loadClientDashboard() {
    await loadClientMensualidades(currentClientPlaca);
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', loadTarifas); // Cargar tarifas al inicio

loginBtn.addEventListener('click', login);
logoutBtnAdmin.addEventListener('click', logout);
logoutBtnClient.addEventListener('click', logout);

// Navegación de pestañas
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        // Remover 'active' de todos los botones y contenidos
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

        // Añadir 'active' al botón clickeado
        e.target.classList.add('active');

        // Mostrar el contenido de la pestaña correspondiente
        const tabId = e.target.dataset.tab;
        document.getElementById(tabId).classList.remove('hidden');

        // Special load for client tabs
        if (currentUserRole === 'cliente') {
            if (tabId === 'mis-mensualidades') {
                loadClientMensualidades(currentClientPlaca);
            }
        }
    });
});

// Admin listeners
registrarEntradaBtn.addEventListener('click', registrarEntrada);
registrarSalidaBtn.addEventListener('click', () => {
    registrarSalida();
    generarComprobanteBtn.onclick = () => generarComprobante(lastParkedVehicleOut);
});


registrarMensualidadBtn.addEventListener('click', registrarMensualidad);
exportarMensualidadesBtn.addEventListener('click', exportarMensualidadesToExcel);

guardarTarifasBtn.addEventListener('click', guardarTarifas);
buscarClienteBtn.addEventListener('click', buscarCliente);
resetPassBtn.addEventListener('click', resetearContrasenaCliente);

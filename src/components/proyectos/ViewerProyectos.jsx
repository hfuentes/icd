import React from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import '../../extensions/FiltrosVisuales.js';  
import '../../extensions/HandleSelectionExtension.js';
import { buscaKeys, transformJsonToArray, printConsola, consulta_filtro2 } from '../../utils/ViewerUtils';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import API_BASE_URL from '../../config';
import { ProyectoContext } from '../../context/ProyectoContext'; // Asegúrate de que la ruta es correcta

const { Autodesk } = window;

class ViewerProyectos extends React.Component {
    static contextType = ProyectoContext;
    constructor(props) {
        super(props);
        this.state={
            idsConFecha: [], // Guarda los IDs con fecha
            idsSinFecha: [], // Guarda los IDs sin fecha
            nombreParametroFecha: '',
            filtro1: '',
            filtro2: ''
        },
        this.container = React.createRef();
        this.viewer = null;
        this.runtime = {
            options: null,
            ready: null
        };
    }

    componentDidMount() {
        this.getForgeToken()
            .then(token => {
                return this.initializeViewerRuntime(token);
            })
            .then(() => {
                this.setupViewer();
            })
            .catch(err => console.error(err));
            this.context.registerAction('generarTotalPesoPisos', this.generarTotalPesoPisos);
    }

    getForgeToken = () => {
        const url = `${API_BASE_URL}/api/gettoken`;
        return fetch(url)
            .then(res => res.json())
            .then(data => {
                return data.token;
            });
    }

    initializeViewerRuntime = (token) => {
        
        if (!this.runtime.ready) {
            this.runtime.options = { 
                ...this.props.runtime,
                getAccessToken: (callback) => callback(token, 3600)
            };
            this.runtime.ready = new Promise((resolve) => Autodesk.Viewing.Initializer(this.runtime.options, resolve));
        }
       
        return this.runtime.ready;
    }

    setupViewer = () => {
        this.viewer = new Autodesk.Viewing.GuiViewer3D(this.container.current);
        this.viewer.start();
   
        this.viewer.loadExtension('HandleSelectionExtension');
        this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, this.onModelLoaded);
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onViewerCameraChange);
        this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, this.onViewerSelectionChange);
        this.updateViewerState({});
    }

    componentWillUnmount() {
        if (this.viewer) {
            this.viewer.removeEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, this.onModelLoaded);
            this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onViewerCameraChange);
            this.viewer.removeEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, this.onViewerSelectionChange);
            this.viewer.finish();
            this.viewer = null;
        }
    }
    
    componentDidUpdate(prevProps) {
        console.log("nueva urn a cargar");
        console.log(this.props.urn);
       
        if (this.viewer && (this.props.urn !== prevProps.urn || this.props.idUsuario !== prevProps.idUsuario || this.props.proyectoKey !== prevProps.proyectoKey)) {
            try {
            Autodesk.Viewing.Document.load(
                'urn:' + this.props.urn,
                    (doc) => {
                        try {
                            // Intenta cargar el documento
                            this.viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry());
                        } catch (error) {
                            // Captura errores durante la carga del documento
                            console.error("Error al cargar el documento:", error);
                            toast.info('Error al cargar el documento. Intenta nuevamente más tarde.');
                        }
                    },
                (code, message, errors) =>{ 
                    console.log("no se pudo cargar debe traducir");
                        toast.info('No se pudo abrir, proceso de traducción del archivo iniciado');
                        console.error(code, message, errors);
                    }
            );
            } catch (error) {
                // Captura errores durante la carga de la URN
                console.error("Error al cargar la URN:", error);
                toast.info('Error al cargar. Verifica la URN e intenta nuevamente.');
        }
    }
    }
    cargarConfiguracion = async () => {
        const url = `${API_BASE_URL}/api/configuracionViewer`;
        try {
            const respuesta = await fetch(url);
            const resultado = await respuesta.json();
            if (respuesta.ok) {
                const { configuracion } = resultado;
                // Actualiza el estado con el nombre del parámetro de fecha obtenido
                this.setState({ nombreParametroFecha: configuracion.variableTiempo || '' });
                this.setState({ nombreParametroBarra: configuracion.variableBarra|| '' });
                console.log("parametro fecha buscado");
                console.log( configuracion.variableBarra);
                console.log(configuracion.variableTiempo);
            } else {
                console.error('Configuración no encontrada:', resultado.mensaje);
            }
        } catch (error) {
            console.error('Error al cargar la configuración:', error);
        }
    };
   sumarPesosPorFiltro2 = (idsBarras) => {
        // Agrupar y sumar los pesos por el valor de filtro2 (ejemplo: AEC Piso)
        const sumaPesos = idsBarras.reduce((acumulador, barraActual) => {
            // Usar el valor de filtro2 como clave
            const clave = barraActual.nombreFiltro2; // Asume que filtro2 es una variable o constante que contiene la cadena 'AEC Piso'
            const pesoActual = barraActual.pesoLineal * barraActual.longitudTotal / 100; // Convertir longitud en metros y calcular peso
            if (!acumulador[clave]) {
                acumulador[clave] = 0; // Si no existe la clave, inicializarla en 0
            }
            acumulador[clave] += pesoActual; // Sumar el peso de la barra actual al total para este piso
            return acumulador;
        }, {});
        return sumaPesos;
    };
  // Asumiendo que obtenerIdsBarras y sumarPesosPorFiltro2 están definidas en el mismo ámbito
  sumarPesosPorDiametroEnPiso = async(idsBarras) => {
    const resultadosPorPiso = {};
    idsBarras.forEach(barra => {
        const piso = barra.nombreFiltro2;
        const diametro = barra.diametroBarra;
        const peso = barra.pesoLineal * (barra.longitudTotal / 100); // Asume que longitudTotal está en mm, convertido a m
        // Inicializa el objeto para el piso si aún no existe
        if (!resultadosPorPiso[piso]) {
            resultadosPorPiso[piso] = {};
        }
        // Inicializa el acumulador para el diámetro en el piso específico si aún no existe
        if (!resultadosPorPiso[piso][diametro]) {
            resultadosPorPiso[piso][diametro] = 0;
        }
        // Suma el peso al acumulador del diámetro en el piso específico
        resultadosPorPiso[piso][diametro] += peso;
    });
    // Opcionalmente, convertir los resultados en una estructura de arreglo para fácil manipulación o envío
    const resultadosArray = Object.entries(resultadosPorPiso).map(([piso, diametrosYpesos]) => {
        return {
            piso,
            diametros: Object.entries(diametrosYpesos).map(([diametro, pesoTotal]) => ({
                diametro,
                pesoTotal
            }))
        };
    });
    return resultadosArray;
};
   generarTotalPesoPisos = async () => {
    try {
        const idsBarras = await this.obtenerIdsBarras();
        // Asumiendo que sumarPesosPorFiltro2 devuelve directamente el resultado,
        // sin necesidad de esperar una promesa.
        const resultado = this.sumarPesosPorFiltro2(idsBarras);
        console.log("PESOS POR PISO", resultado); // Esto imprimirá un objeto con los totales de peso por cada valor de 'AEC Piso'
        // Preparar los datos para enviar
        const datosParaEnviar = {
            urn: this.props.urn, // Asegúrate de tener urn en el ámbito
            nombreFiltro2: this.state.filtro2, // Asegúrate de tener nombreFiltro2 en el ámbito
            pesosPorValor: Object.entries(resultado).map(([valor, sumaPeso]) => ({ valor, sumaPeso }))
        };
        console.log("datos para enviar pesos pisos",datosParaEnviar);
        // Enviar los datos al servidor
        const url = `${API_BASE_URL}/api/sumaTotalpiso`; // Asegúrate de que API_BASE_URL esté definido
        const respuesta = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(datosParaEnviar),
        });
        if (!respuesta.ok) {
            throw new Error('Error al enviar datos al servidor');
        }
        const datosRespuesta = await respuesta.json();
        console.log('Datos guardados con éxito:', datosRespuesta);
        const diametroPiso = await this.sumarPesosPorDiametroEnPiso(idsBarras);
        const datosParaEnviarDiametros = {
            urn: this.props.urn,
            nombreFiltro2: this.state.filtro2,
            pesosPorPiso: diametroPiso, // Asegúrate de que esto sea una lista de { piso, diametros: [{ diametro, pesoTotal }] }
        };
        const urlDiametros = `${API_BASE_URL}/api/respuestasDiametros`; // Asegúrate de que API_BASE_URL esté definido
        try {
            const respuestaDiametros = await fetch(urlDiametros, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosParaEnviarDiametros), // Convertir todo el objeto a JSON
            });
            if (!respuesta.ok) throw new Error('Error al enviar datos al servidor para pesos por diámetro en piso');
           // console.log('Datos de pesos por diámetro en piso guardados con éxito:', await respuesta.json());
           // console.log("Datos desde server",respuestaDiametros);
        } catch (error) {
            console.error("Error al enviar total de peso por diámetro en piso:", error);
        }
        const datosParaInsertar = {
            urn: this.props.urn, // Utiliza la URN desde las props
            lista: idsBarras.map(barra => ({ // Asegúrate de que este mapeo coincide con lo esperado por tu backend
                nombreFiltro1: barra.nombreFiltro1, // Ajusta según tus datos
                nombreFiltro2: barra.nombreFiltro2,
                diametroBarra: barra.diametroBarra,
                fecha: barra.fecha,
                id: barra.id,
                longitudTotal: barra.longitudTotal,
                pesoLineal: barra.pesoLineal,
            }))
        };
        console.log("pre barras insertadas",datosParaInsertar);
        const urlBarras = `${API_BASE_URL}/api/barraurn`; 
        const barrasInsertadas = await axios.post(urlBarras, datosParaInsertar);
        console.log("PESOS POR diametro piso", diametroPiso);
        console.log("Barras insertadas",barrasInsertadas);
    } catch (error) {
        console.error("Error generando total de peso por pisos:", error);
    }
};
// Asegúrate de llamar a generarTotalPesoPisos en el lugar adecuado de tu aplicación
    obtenerIdsBarras = async () => {
        console.log("inicio busqueda de barras", this.state);
        return new Promise(async (resolve, reject) => {
            if (!this.viewer || !this.viewer.model) {
                return reject(new Error("El modelo del visualizador no está cargado."));
            }
            try {
                const { filtro1, filtro2, nombreParametroFecha } = this.state;
                // Utilizando BulkProperties para obtener las propiedades de todos los elementos
                this.viewer.model.getBulkProperties([], { propFilter: ['Category', filtro1, filtro2, 'RS Peso Lineal (kg/m)', 'Total Bar Length', 'Bar Diameter', nombreParametroFecha] }, (result) => {
                    let idsBarras = result.filter(element => 
                        element.properties.some(prop => 
                            prop.displayName === 'Category' && prop.displayValue === 'Revit Structural Rebar'
                        )
                    ).map(element => {
                        // Encuentra valores para los filtros, peso lineal, longitud total, diámetro de barra y fecha
                        const propFiltro1 = element.properties.find(prop => prop.displayName === filtro1)?.displayValue || '';
                        const propFiltro2 = element.properties.find(prop => prop.displayName === filtro2)?.displayValue || '';
                        const pesoLineal = element.properties.find(prop => prop.displayName === 'RS Peso Lineal (kg/m)')?.displayValue || '0';
                        const longitudTotal = element.properties.find(prop => prop.displayName === 'Total Bar Length')?.displayValue || '0';
                        const diametroBarra = element.properties.find(prop => prop.displayName === 'Bar Diameter')?.displayValue || '0';
                        const fecha = element.properties.find(prop => prop.displayName === nombreParametroFecha)?.displayValue || '';
                        return {
                            id: element.dbId,
                            nombreFiltro1: propFiltro1,
                            nombreFiltro2: propFiltro2,
                            pesoLineal: parseFloat(pesoLineal),
                            longitudTotal: parseFloat(longitudTotal),
                            diametroBarra: parseFloat(diametroBarra),
                            fecha
                        };
                    });
                    // Guarda los resultados en el estado o maneja como prefieras
                    this.setState({ idsBarras });
                    // Resolver la promesa con los IDs de barras encontrados
                    resolve(idsBarras);
                });
            } catch (error) {
                console.error("Error al obtener IDs de barras:", error);
                reject(error);
            }
        });
    };
    consultaFiltro = (filtros) => {
        return new Promise((resolve, reject) => {
            if (!this.viewer || !this.viewer.model) {
                reject(new Error("El modelo del visualizador no está cargado."));
                return;
            }
            this.viewer.model.getBulkProperties([], filtros, (result) => {
                let test = result.filter(x => x.properties.length === filtros.length);
                let data = {};
                test.forEach(element => {
                    // Procesamiento de los resultados
                    if (element.properties.length === 1) {
                        let key = element.properties[0].displayValue;
                        if (key in data) {
                            data[key].cantidad++;
                            data[key].dbIds.push(element.dbId);
                        } else {
                            let a = {
                                cantidad: 1,
                                dbIds: [element.dbId]
                            };
                            data[key] = a;
                        }
                    }
                    // Más lógica de procesamiento si es necesario
                });
                console.log("Resultado obtenido:");
                console.log(data); // Muestra el resultado por consola
                resolve(data);
                resolve(data);
            }, (error) => {
                reject(error);
            });
        });
    };
    obtenerFiltros = async (urnBuscada) => {
        return new Promise(async (resolve, reject) => {
            try {
                console.log("URN ANTES DE AXIOS");
                console.log(this.props);
                const response = await axios.get(`${API_BASE_URL}/api/filtros`);
                console.log("Respuesta Filtros:", response.data);
                let filtrado1 = response.data[0].filtro_1;
                let filtrado2 = response.data[0].filtro_2;
                // Actualiza el estado con los nuevos filtros y fierros.
                this.setState({ filtro1: filtrado1, filtro2: filtrado2, fierros: response.data[0].fierro }, async () => {
                    console.log("Filtros actualizados en el estado:", filtrado1, filtrado2);
                    // Después de actualizar el estado, procede con la consulta de filtros.
                    try {
                        const datosFiltro1 = await this.consultaFiltro([filtrado1]);
                        //this.context.updateDatosFiltro1(datosFiltro1);
                        console.log("filtro datos 1",datosFiltro1);
                        const datosFiltro2 = await this.consultaFiltro([filtrado2]);
                        console.log("filtro datos 2",datosFiltro2);
                       // this.context.updateDatosFiltro2(datosFiltro2);
                        // Una vez completado todo, resuelve la promesa.
                        resolve();
                    } catch (error) {
                        console.error("Error al consultar los filtros:", error);
                        reject(error);
                    }
                });
            } catch (error) {
                console.error("Error al obtener los filtros:", error);
                reject(error);
            }
        });
    };
    obtenerIdsConFecha = async () => {
        return new Promise((resolve, reject) => {
            if (!this.viewer || !this.viewer.model) {
                return reject(new Error("El modelo del visualizador no está cargado."));
            } else {
                const { nombreParametroFecha, urn } = this.state;
                console.log("NOMBRE DEL PARAMETRO FECHA");
                console.log(nombreParametroFecha);
                this.viewer.model.getBulkProperties([], { propFilter: [nombreParametroFecha] }, async (result) => {
                    let idsConFechaYValor = result
                        .filter(element => element.properties.some(prop => prop.displayName === nombreParametroFecha))
                        .map(element => {
                            let propiedadFecha = element.properties.find(prop => prop.displayName === nombreParametroFecha);
                            return {
                                id: element.dbId,
                                fecha: propiedadFecha ? propiedadFecha.displayValue : null
                            };
                        });
    
                    // Ahora iteramos sobre cada ID para asegurarnos de que exista un registro para él
                    for (let objeto of idsConFechaYValor) {
                        await axios.post(`${API_BASE_URL}/api/crearObjetoProyectoPlan`, {
                            urn:this.props.urn,
                            IdObjeto: objeto.id,
                            fecha_plan: objeto.fecha,
                            // Los demás campos pueden ir según necesites, o dejarlos como undefined si son opcionales
                        });
                    }
    
                    console.log("IDs con fecha y su valor:", idsConFechaYValor);
                    resolve(idsConFechaYValor);
                }, (error) => {
                    reject(error);
                });
            }
        });
    };
    getIdManageFecha = async () => {
        console.log("Inicio búsqueda de ids fechas");
    
        try {
            const idsConFecha = await this.obtenerIdsConFecha();
            const idsSinFecha = await this.obtenerIdsSinFecha();
            this.setState({ idsConFecha, idsSinFecha });
        } catch (error) {
            console.error("Error al obtener IDs:", error);
            // A pesar del error, el flujo del programa continúa, evitando bloquear la pantalla.
        }
    }
    
    obtenerIdsSinFecha = async () => {
        return new Promise((resolve, reject) => {
            if (!this.viewer || !this.viewer.model) {
                return reject(new Error("El modelo del visualizador no está cargado."));
            }
    
            const { nombreParametroFecha, urn } = this.state;
    
            this.viewer.model.getBulkProperties([], { propFilter: [nombreParametroFecha] }, async (result) => {
                let idsSinFecha = result.filter(element => !element.properties.some(prop => prop.displayName === nombreParametroFecha)).map(element => element.dbId);
                
                // Ahora iteramos sobre cada ID sin fecha para asegurarnos de que exista un registro para él
                for (let idSinFecha of idsSinFecha) {
                    await axios.post(`${API_BASE_URL}/api/crearObjetoProyectoPlan`, {
                        urn: this.props.urn,
                        IdObjeto: idSinFecha,
                        fecha_plan: '', // Enviamos un string vacío para fecha_plan
                        // Los demás campos pueden ir según necesites, o dejarlos como undefined si son opcionales
                    });
                }
    
                console.log("IDS SIN FECHA:", idsSinFecha);
                resolve(idsSinFecha);
            }, (error) => {
                reject(error);
            });
        });
    };
    updateViewerState = (prevProps) => {
        if (this.props.urn && this.props.urn !== prevProps.urn) {
            Autodesk.Viewing.Document.load(
                'urn:' + this.props.urn,
                (doc) => this.viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()),
                (code, message, errors) => console.error(code, message, errors)
            );
        }
    };

    onModelLoaded = async () => {
        try {
            // Espera a que ambas funciones asincrónicas se completen.
            const [idsConFecha, idsSinFecha] = await Promise.all([
              //  this.obtenerIdsConFecha(),
               /// this.obtenerIdsSinFecha()
            ]);
    
            // Actualiza el estado con los resultados obtenidos.
            this.setState({ idsConFecha, idsSinFecha });
            this.cargarConfiguracion();
            await this.obtenerFiltros(this.props.urn).then(async () => {
                try {
                    const idsBarras = await this.obtenerIdsBarras();
                    console.log("IDs de barras obtenidos:", idsBarras);
                } catch (error) {
                    console.error("Error al obtener IDs de barras:", error);
                }
            });
        } catch (error) {
            console.error("Error al obtener IDs:", error);
        }
    };
    
    onViewerCameraChange = (event) => {
        // Manejar el cambio de la cámara del visor aquí si es necesario
    };

    onViewerSelectionChange = (event) => {
        // Manejar el cambio de la selección del visor aquí si es necesario
    };

    render() {
        return <div ref={this.container} style={{ position: 'relative', marginLeft: '5px', marginTop: '27px', width: '100%', height: '380px' }} />;
    }
}

ViewerProyectos.propTypes = {
    urn: PropTypes.string.isRequired,
    idUsuario: PropTypes.string.isRequired, // Nueva prop idUsuario
    proyectoKey: PropTypes.string.isRequired, // Nueva prop proyectoKey
    runtime: PropTypes.object
    
};

export default ViewerProyectos;

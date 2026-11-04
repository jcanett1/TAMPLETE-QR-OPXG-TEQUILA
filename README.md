# QR Studio · PXG Tequila

Aplicación web para importar inventario, capturar artículos manualmente y crear etiquetas QR listas para imprimir en Word.

## Funciones

- Importa la primera hoja de archivos **Excel `.xlsx`** o archivos **CSV**. Los encabezados comunes en español o inglés se sugieren automáticamente y pueden corregirse antes de importar. Los archivos antiguos `.xls` deben guardarse como `.xlsx` o `.csv`.
- Captura y corrige número de parte, descripción, locación y fecha antes de generar. La fecha inicia en hoy. En las etiquetas Word descargadas, la locación aparece solo como valor (por ejemplo, `E-28`), sin el prefijo `LOCATION:`.
- Genera un QR por registro con número de parte y locación en texto simple, cada valor en su propia línea, sin claves, llaves ni comillas JSON. La opción Registro completo agrega descripción y fecha, también como texto simple.
- Ofrece dos plantillas basadas en los ejemplos: **8 etiquetas compactas (2 columnas × 4 filas)** o **3 etiquetas ampliadas (1 columna × 3 filas)** por página, en papel Carta o A4.
- Permite recorrer la vista previa de todas las hojas y exportar un documento Word `.docx`. También abre el diálogo nativo de impresión/vista previa del navegador para imprimir todas las etiquetas del lote.

## Uso

1. La aplicación inicia vacía. Carga tu inventario `.xlsx`/`.csv` o agrega artículos manualmente.
2. Confirma el mapeo de columnas y corrige los campos marcados para revisión.
3. Elige Compacta o Ampliada, el papel y los datos del QR.
4. Revisa las hojas. Desde Salida, genera el Word o selecciona **Imprimir / vista previa** para mandar a imprimir todo el lote desde el navegador. Usa el papel elegido y escala 100 % en el diálogo de impresión.

La plantilla `plantilla-inventario.xlsx` contiene los encabezados **Numero de parte**, **Descripcion**, **Locacion** y **Fecha**, además de una fila vacía para tus datos. No incluye registros de ejemplo.

## Privacidad

La lectura del inventario, la generación del QR, la exportación Word y la impresión ocurren en el navegador. Los artículos y ajustes se guardan automáticamente en el `localStorage` de este navegador para que sigan disponibles al recargar; no se envían a un servidor ni se guardan en una base de datos. El botón **Eliminar carga** borra los artículos importados o capturados y conserva los ajustes de formato. Si borras los datos del sitio en el navegador, también se elimina el inventario local.

## Desarrollo

Requiere Node.js y pnpm 10.28.0. Desde la raíz del proyecto:

```bash
pnpm install
pnpm dev
```

Verificación local:

```bash
pnpm check
pnpm test
pnpm build
```

# Visor de Unidades de Gestión Ambiental · POEL Atoyac de Álvarez, Guerrero

Visor web estático (HTML + Leaflet 1.9.4) del modelo de ordenamiento ecológico local (versión 06/08/2026).
No requiere servidor ni base de datos: se publica directamente con **GitHub Pages**.

## Estructura

```
index.html            Página principal
css/visor.css         Estilos (paleta guinda #611232 / #8E1D3F, dorado #A57F2C, café #32260D–#846623)
js/visor.js           Lógica del visor
data/ugas.js          130 UGA (WGS84, simplificación 2.5 m) con atributos, usos, criterios y estrategias
data/ejidos.js        41 núcleos agrarios (RAN) disueltos por nombre + UGA que intersectan
data/localidades.js   168 localidades ITER con UGA y ejido asignados por cruce espacial
data/catalogos.js     Catálogos: usos del suelo, criterios, estrategias, lineamientos
scripts/build_data.py Regenera data/*.js desde los shapefiles y la base de claves
```

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a la raíz del repositorio (o a `/docs`).
2. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch** → rama `main`, carpeta `/ (root)` o `/docs`.
3. El visor queda en `https://<usuario>.github.io/<repositorio>/`.

También funciona abriendo `index.html` directamente en el navegador (los datos se cargan como `.js`, no por `fetch`).

Enlace directo a una UGA: `…/index.html#uga=25`

## Actualizar los datos del modelo

```bash
pip install geopandas shapely openpyxl
python scripts/build_data.py \
  --modelo      SIG/Modelo_Atoyac_060826.shp \
  --ejidos      SIG/Ejidos_Atoyac.shp \
  --localidades SIG/12011_LOCALIDADES.shp \
  --claves      SIG/Modelo_Atoyac_Base_Claves_060826.xlsx \
  --out data/
```

Campos que usa el visor: `UGA_FIN, Clave_UGA, ID_UGA_Pas, Poblacion, Sup_ha, Densidad, Politica, GRUPO, Clave_Line, Lineam1–5,
USV_PRODOM, Ejidos, Localidade, Zon_CONAFO, Problemati, Estrateg1, Criter1–11`, las 41 columnas binarias de uso (AgR … Tru)
y los indicadores `apt_*, apceb, apmsa1, eco_pri, frg_veg, ret_sue, capt_carb, capt_carb_, rec_acu, balan_hi, roinc, risg_extin,
RIQ_SPS, MDE, pend_*, PP_MA, TA_MA, GHI, PVOUT, WDM`.

El script corrige automáticamente las diferencias de clave entre el shapefile y la hoja *Criterios*
(`Acu→Acui`, `CS→Caf`, `Agr→AgR`, `Fnm→FnM`, `Mnm→MnM`, `Plant→Fru`, y `Cgral06Cgral07` → `Cgral06, Cgral07`).

## Funciones

- **Buscadores (panel izquierdo):** usos del suelo (verde claro = compatible, naranja oscuro = incompatible), UGA (UGA_FIN, con filtro por política), ejidos y localidades ITER.
- **Tema:** *Contorno* (límite guinda + etiqueta UGA_FIN negra con halo blanco) o *Política* (Aprovechamiento sustentable amarillo, Preservación verde claro, Protección verde oscuro, ADVC con rayas moradas a 90°, ANP con rayas rosas a 45°, Restauración café). Control de transparencia.
- **Popup** con información básica y botón **Ver ficha completa** (panel derecho: lineamiento, usos, criterios agrupados por actividad con ventana explicativa, estrategias, contexto territorial e indicadores).
- **Capas:** encendido/apagado de UGA, ejidos y localidades y sus etiquetas; las etiquetas aparecen según el zoom y se priorizan por población (localidades) y superficie (ejidos, UGA). Mapas base: OpenStreetMap, gris claro, satélite y satélite con referencias.

Fuentes: Modelo POEL Atoyac de Álvarez (06/08/2026) · RAN, Núcleos agrarios · INEGI, ITER.

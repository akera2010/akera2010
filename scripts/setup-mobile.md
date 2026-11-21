# 📱 Setup Obsidian en iPhone

## Apps necesarias (gratuitas)
1. **Obsidian** — App Store
2. **Working Copy** — App Store (cliente git para iOS)

## Paso a paso

### 1. Working Copy — conectar GitHub
1. Abre Working Copy
2. Toca el `+` → Clone Repository
3. URL: `https://github.com/akera2010/akera2010`
4. Autentícate con GitHub (OAuth)
5. Espera que clone

### 2. Obsidian — abrir el vault
1. Abre Obsidian
2. "Abrir carpeta como vault" → selecciona `akera2010/obsidian` desde Working Copy
   - Working Copy → tu repo → `obsidian/` → Share → Open in Obsidian

### 3. Plugin Obsidian Git (opcional en móvil)
- En móvil es más cómodo usar Working Copy para sync manual
- Working Copy puede auto-fetch en background

## Flujo diario en el móvil
1. Abre Working Copy → Pull (para obtener lo último)
2. Abre Obsidian → crea nota en `04-Inbox/` con tus ideas
3. Vuelve a Working Copy → Commit + Push
4. En la próxima sesión de Claude, revisará el inbox

## Captura ultra-rápida (atajo iOS)
Puedes crear un Shortcut de iOS:
- Acción: Pedir texto → Guardar archivo en Working Copy → `akera2010/obsidian/04-Inbox/[fecha].md`
- Aparecerá en la barra de compartir / Siri

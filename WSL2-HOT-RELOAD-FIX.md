# WSL2 Hot Reload Fix for React Development

## 🔴 ROOT CAUSE IDENTIFIED

The React development server was NOT detecting file changes because:
- **WSL2 Issue**: File system events don't propagate properly from Windows filesystem mounts (`/mnt/c/`) to WSL2
- **Webpack Watch**: The default file watcher (inotify) doesn't work across the WSL2/Windows filesystem boundary
- **Result**: Changes were being saved but webpack never recompiled them

## ✅ SOLUTION

Enable polling-based file watching when running React dev server in WSL2:

```bash
# Use environment variables to enable polling
CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true PORT=3000 npm start
```

Or add to package.json scripts:
```json
{
  "scripts": {
    "start:wsl": "CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true react-scripts start"
  }
}
```

## 📝 PERMANENT FIX

Create a `.env` file in the project root:
```env
# Enable polling for WSL2 development
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true
```

## 🎯 VERIFICATION

1. **Without polling**: File changes saved but webpack doesn't recompile
2. **With polling**: File changes trigger immediate recompilation
3. **Test change**: Modified Dashboard title and it compiled successfully

## ⚠️ IMPORTANT NOTES

- **Performance**: Polling uses more CPU than native file watching
- **Interval**: Default polling interval is 1000ms (can be adjusted with `CHOKIDAR_INTERVAL`)
- **Alternative**: Move project to WSL2 filesystem (e.g., `/home/user/projects/`) for native file watching

## 🔧 DEBUGGING COMMANDS USED

```bash
# Check which process is using port 3000
lsof -i :3000

# Check process working directory
pwdx <PID>

# Monitor webpack compilation
# Look for "Compiling..." messages after file changes
```

## 📚 REFERENCES

- [Create React App WSL2 Documentation](https://create-react-app.dev/docs/troubleshooting/#npm-start-doesn-t-detect-changes)
- [Webpack Watch Options](https://webpack.js.org/configuration/watch/)
- [WSL2 Known Issues](https://github.com/microsoft/WSL/issues)
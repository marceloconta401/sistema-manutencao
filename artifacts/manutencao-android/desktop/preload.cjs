const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("maintenanceDesktop", {
  showNotification(payload) {
    if (!payload || typeof payload.title !== "string" || typeof payload.body !== "string") return;
    ipcRenderer.send("maintenance:notification", {
      title: payload.title.slice(0, 120),
      body: payload.body.slice(0, 500),
      callId: typeof payload.callId === "string" ? payload.callId.slice(0, 100) : "",
    });
  },
});

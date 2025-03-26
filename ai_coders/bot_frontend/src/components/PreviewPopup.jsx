import JSZip from "jszip";

// Cosmic preview popup function
const PreviewPopup = ({ fileContent, fileName, socket, postTaskOptions, setMessages }) => {
  const userName = localStorage.getItem("userName") || "Guest";

  const handlePreview = async () => {
    try {
      const zip = new JSZip();
      await zip.loadAsync(fileContent, { base64: true });

      const files = {};
      const blobs = [];
      for (const [name, file] of Object.entries(zip.files)) {
        const ext = name.split(".").pop().toLowerCase();
        files[name] = await file.async("arraybuffer");
        const mimeType = {
          html: "text/html",
          css: "text/css",
          js: "application/javascript",
          jsx: "application/javascript",
          ts: "application/javascript",
          vue: "application/javascript",
          md: "text/markdown",
          txt: "text/plain",
          csv: "text/csv",
          json: "application/json",
          xml: "application/xml",
          yaml: "application/x-yaml",
          toml: "application/toml",
          sh: "text/x-sh",
          ps1: "text/x-powershell",
          sql: "text/x-sql",
          Dockerfile: "text/x-dockerfile",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          svg: "image/svg+xml",
          webp: "image/webp",
          pdf: "application/pdf",
          mp4: "video/mp4",
          mp3: "audio/mpeg",
          wav: "audio/wav",
          exe: "application/octet-stream",
          bat: "text/x-batch",
          py: "text/x-python",
          php: "application/x-httpd-php",
          rb: "text/x-ruby",
          java: "text/x-java-source",
          cpp: "text/x-c++src",
          go: "text/x-go",
          rs: "text/x-rustsrc",
          kt: "text/x-kotlin",
          swift: "text/x-swift",
          cs: "text/x-csharp",
          r: "text/x-rsrc",
          scala: "text/x-scala",
          dart: "text/x-dart",
          pl: "text/x-perl",
          lua: "text/x-lua",
          zip: "application/zip",
        }[ext] || "application/octet-stream";
        blobs.push({ name, blob: new Blob([files[name]], { type: mimeType }) });
      }

      if (blobs.length === 0) throw new Error("No files found in ZIP for preview");

      const previewHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cracker Bot Preview - ${fileName}</title>
            <style>
              body {
                margin: 0;
                font-family: 'Courier New', monospace;
                background: linear-gradient(135deg, #1a1a1a, #2a2a4a);
                color: #00ff00;
                overflow: hidden;
              }
              .container {
                display: flex;
                height: 100vh;
              }
              .sidebar {
                width: 200px;
                background: #0a0a23;
                padding: 20px;
                border-right: 2px solid #ff00ff;
                overflow-y: auto;
              }
              .content {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
              }
              .tab {
                padding: 10px;
                cursor: pointer;
                background: #ff007a;
                margin-bottom: 5px;
                border-radius: 5px;
                transition: all 0.3s;
              }
              .tab:hover, .tab.active {
                background: #00ffcc;
                box-shadow: 0 0 10px #00ffcc;
              }
              iframe, img, video, audio, pre {
                width: 100%;
                max-height: 80vh;
                border: none;
                background: #fff;
              }
              pre {
                background: #0a0a23;
                padding: 10px;
                border-radius: 5px;
                white-space: pre-wrap;
                color: #00ff00;
              }
              .non-previewable {
                text-align: center;
                padding: 20px;
                color: #ff007a;
                text-shadow: 0 0 5px #ff007a;
              }
              .cosmic-portal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, #ff00ff, #00ffff, #1a1a1a);
                animation: portal 1s ease-out forwards;
                z-index: 9999;
              }
              @keyframes portal {
                0% { opacity: 1; transform: scale(0); }
                50% { opacity: 1; transform: scale(1.5); }
                100% { opacity: 0; transform: scale(2); pointer-events: none; }
              }
            </style>
          </head>
          <body>
            <div class="cosmic-portal"></div>
            <div class="container">
              <div class="sidebar">
                ${blobs.map((item, idx) => `<div class="tab" onclick="showTab(${idx})" id="tab-${idx}">${item.name}</div>`).join("")}
              </div>
              <div class="content" id="content">
                <p>Select a file from the sidebar to preview!</p>
              </div>
            </div>
            <script>
              const blobs = ${JSON.stringify(blobs.map((b) => ({ name: b.name, url: URL.createObjectURL(b.blob) })))};
              let activeTab = -1;
              function showTab(index) {
                if (activeTab === index) return;
                if (activeTab >= 0) document.getElementById("tab-" + activeTab).classList.remove("active");
                activeTab = index;
                document.getElementById("tab-" + index).classList.add("active");
                const { name, url } = blobs[index];
                const ext = name.split(".").pop().toLowerCase();
                const mime = blobs[index].blob.type;
                const contentDiv = document.getElementById("content");
                if (["html"].includes(ext)) {
                  contentDiv.innerHTML = '<iframe src="' + url + '"></iframe>';
                } else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
                  contentDiv.innerHTML = '<img src="' + url + '" alt="' + name + '">';
                } else if (["mp4"].includes(ext)) {
                  contentDiv.innerHTML = '<video controls><source src="' + url + '" type="video/mp4"></video>';
                } else if (["mp3", "wav"].includes(ext)) {
                  contentDiv.innerHTML = '<audio controls><source src="' + url + '" type="' + mime + '"></audio>';
                } else if (["pdf"].includes(ext)) {
                  contentDiv.innerHTML = '<iframe src="' + url + '#view=FitH"></iframe>';
                } else if (["js", "ts", "jsx", "vue", "md", "txt", "csv", "json", "xml", "yaml", "toml", "sh", "ps1", "sql", "Dockerfile"].includes(ext)) {
                  fetch(url).then(res => res.text()).then(text => {
                    contentDiv.innerHTML = '<pre>' + text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</pre>';
                  });
                } else {
                  contentDiv.innerHTML = '<div class="non-previewable">"' + name + '" can’t be previewed here—check the README to run it locally! 🚀</div>';
                }
              }
              showTab(0);
              window.addEventListener("unload", () => {
                blobs.forEach(b => URL.revokeObjectURL(b.url));
              });
            </script>
          </body>
        </html>`;

      const previewBlob = new Blob([previewHtml], { type: "text/html" });
      const previewUrl = URL.createObjectURL(previewBlob);
      const previewWindow = window.open(previewUrl, "_blank", "width=800,height=600");
      if (!previewWindow) throw new Error("Pop-up blocked—allow pop-ups for cosmic vibes!");

      setMessages((prev) => [
        ...prev,
        {
          from: "System",
          user: userName,
          text: `Previewing "${fileName}" in a cosmic window—explore your creation! 🌌`,
          type: "system",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // Re-zip and send to bot_lead for Redis storage
      const newZip = new JSZip();
      for (const [name, buffer] of Object.entries(files)) {
        newZip.file(name, buffer);
      }
      const reZippedContent = await newZip.generateAsync({ type: "base64" });
      socket.emit("message", {
        text: "store_project",
        type: "task_response",
        taskId: postTaskOptions?.taskId || Date.now().toString(),
        frontendId: socket.socket.id,
        user: userName,
        userId: socket.socket.id,
        ip: window.location.hostname,
        taskName: postTaskOptions?.taskName || fileName.replace(".zip", ""),
        taskType: postTaskOptions?.taskType || "unknown",
        taskFeatures: postTaskOptions?.taskFeatures || "unknown",
        fileContent: reZippedContent,
        commandFlag: true,
        target: "bot_lead",
      });

      setMessages((prev) => [
        ...prev,
        {
          from: "System",
          user: userName,
          text: `"${fileName}" preview stored in the cosmic vault—fetch it with /projects! 🏆`,
          type: "system",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(previewUrl);
        blobs.forEach((b) => URL.revokeObjectURL(b.url));
      }, 10000);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          from: "System",
          text: `Preview failed for "${fileName}": ${e.message}—cosmic glitch detected! 💾`,
          type: "error",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  handlePreview();
};

export default PreviewPopup;
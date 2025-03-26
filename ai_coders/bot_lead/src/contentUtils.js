import JSZip from "jszip";
import { log, error } from "./logger.js";

// Maps file extensions to dependency/setup info for README
const fileTypeInfo = {
  html: {
    dependencies: "A modern web browser (e.g., Chrome, Firefox)",
    setup: "Open <strong>${fileName}</strong> in your browser to launch the project.",
    previewable: true,
  },
  js: {
    dependencies: "Node.js (install via <a href='https://nodejs.org/'>nodejs.org</a>)",
    setup: "Run <code>node ${fileName}</code> in the terminal from the project directory.",
    previewable: true, // As text in browser
  },
  jsx: {
    dependencies: "Node.js with React (install via <a href='https://nodejs.org/'>nodejs.org</a> and <code>npm install react</code>)",
    setup: "Integrate into a React project and run <code>npm start</code>.",
    previewable: true, // As text
  },
  ts: {
    dependencies: "Node.js with TypeScript (install via <code>npm install -g typescript</code>)",
    setup: "Compile with <code>tsc ${fileName}</code>, then run <code>node ${fileName.replace('.ts', '.js')}</code>.",
    previewable: true, // As text
  },
  vue: {
    dependencies: "Node.js with Vue.js (install via <code>npm install -g @vue/cli</code>)",
    setup: "Integrate into a Vue project and run <code>npm run serve</code>.",
    previewable: true, // As text
  },
  py: {
    dependencies: "Python 3.x (install via <a href='https://www.python.org/'>python.org</a>)",
    setup: "Run <code>python ${fileName}</code> in the terminal from the project directory.",
    previewable: true, // As text (future: Pyodide)
  },
  php: {
    dependencies: "PHP (install via <a href='https://www.php.net/'>php.net</a>) and a web server (e.g., Apache)",
    setup: "Place in a web server directory and access via browser (e.g., http://localhost/${fileName}).",
    previewable: true, // As text
  },
  rb: {
    dependencies: "Ruby (install via <a href='https://www.ruby-lang.org/'>ruby-lang.org</a>)",
    setup: "Run <code>ruby ${fileName}</code> in the terminal.",
    previewable: true, // As text
  },
  java: {
    dependencies: "Java JDK (install via <a href='https://www.oracle.com/java/'>oracle.com/java</a>)",
    setup: "Compile with <code>javac ${fileName}</code>, then run <code>java ${fileName.replace('.java', '')}</code>.",
    previewable: true, // As text
  },
  cpp: {
    dependencies: "C++ compiler (e.g., g++, install via <a href='https://gcc.gnu.org/'>gcc.gnu.org</a>)",
    setup: "Compile with <code>g++ ${fileName} -o ${name}</code>, then run <code>./${name}</code> (Linux/Mac) or <code>${name}.exe</code> (Windows).",
    previewable: true, // As text
  },
  go: {
    dependencies: "Go (install via <a href='https://golang.org/'>golang.org</a>)",
    setup: "Run <code>go run ${fileName}</code> or compile with <code>go build ${fileName}</code>.",
    previewable: true, // As text
  },
  rs: {
    dependencies: "Rust (install via <a href='https://www.rust-lang.org/'>rust-lang.org</a>)",
    setup: "Run <code>rustc ${fileName} -o ${name}</code>, then <code>./${name}</code>.",
    previewable: true, // As text
  },
  kt: {
    dependencies: "Kotlin (install via <a href='https://kotlinlang.org/'>kotlinlang.org</a>)",
    setup: "Compile with <code>kotlinc ${fileName} -include-runtime -d ${name}.jar</code>, then run <code>java -jar ${name}.jar</code>.",
    previewable: true, // As text
  },
  swift: {
    dependencies: "Swift (install via <a href='https://swift.org/'>swift.org</a>)",
    setup: "Run <code>swift ${fileName}</code> or compile with <code>swiftc ${fileName}</code>.",
    previewable: true, // As text
  },
  cs: {
    dependencies: ".NET SDK (install via <a href='https://dotnet.microsoft.com/'>dotnet.microsoft.com</a>)",
    setup: "Compile with <code>csc ${fileName}</code>, then run <code>${fileName.replace('.cs', '.exe')}</code> (Windows).",
    previewable: true, // As text
  },
  r: {
    dependencies: "R (install via <a href='https://www.r-project.org/'>r-project.org</a>)",
    setup: "Run <code>Rscript ${fileName}</code> in the terminal.",
    previewable: true, // As text
  },
  scala: {
    dependencies: "Scala (install via <a href='https://www.scala-lang.org/'>scala-lang.org</a>)",
    setup: "Compile with <code>scalac ${fileName}</code>, then run <code>scala ${fileName.replace('.scala', '')}</code>.",
    previewable: true, // As text
  },
  dart: {
    dependencies: "Dart SDK (install via <a href='https://dart.dev/'>dart.dev</a>)",
    setup: "Run <code>dart ${fileName}</code> in the terminal.",
    previewable: true, // As text
  },
  pl: {
    dependencies: "Perl (install via <a href='https://www.perl.org/'>perl.org</a>)",
    setup: "Run <code>perl ${fileName}</code> in the terminal.",
    previewable: true, // As text
  },
  lua: {
    dependencies: "Lua (install via <a href='https://www.lua.org/'>lua.org</a>)",
    setup: "Run <code>lua ${fileName}</code> in the terminal.",
    previewable: true, // As text
  },
  sh: {
    dependencies: "Bash (available on Linux/Mac, or Git Bash on Windows)",
    setup: "Run <code>bash ${fileName}</code> in the terminal.",
    previewable: true, // As text
  },
  ps1: {
    dependencies: "PowerShell (built-in on Windows, install via <a href='https://docs.microsoft.com/powershell/'>docs.microsoft.com</a>)",
    setup: "Run <code>powershell -File ${fileName}</code> in PowerShell.",
    previewable: true, // As text
  },
  sql: {
    dependencies: "SQL database (e.g., MySQL, PostgreSQL)",
    setup: "Import into your database with <code>mysql -u user -p dbname < ${fileName}</code> (MySQL example).",
    previewable: true, // As text
  },
  yaml: {
    dependencies: "Any YAML parser or editor",
    setup: "View or edit in a text editor; use with compatible tools (e.g., Kubernetes).",
    previewable: true, // As text
  },
  xml: {
    dependencies: "Any XML parser or browser",
    setup: "Open <strong>${fileName}</strong> in a browser or XML editor.",
    previewable: true,
  },
  md: {
    dependencies: "Markdown viewer (e.g., browser with extension, VS Code)",
    setup: "Open <strong>${fileName}</strong> in a Markdown viewer or browser.",
    previewable: true,
  },
  toml: {
    dependencies: "Any TOML parser or editor",
    setup: "View or edit in a text editor; use with compatible tools.",
    previewable: true, // As text
  },
  Dockerfile: {
    dependencies: "Docker (install via <a href='https://www.docker.com/'>docker.com</a>)",
    setup: "Build with <code>docker build -t ${name} -f ${fileName} .</code>, then run <code>docker run ${name}</code>.",
    previewable: true, // As text
  },
  txt: {
    dependencies: "Any text editor or browser",
    setup: "Open <strong>${fileName}</strong> in a text editor or browser.",
    previewable: true,
  },
  csv: {
    dependencies: "Any spreadsheet software (e.g., Excel) or text editor",
    setup: "Open <strong>${fileName}</strong> in Excel, a browser, or text editor.",
    previewable: true,
  },
  json: {
    dependencies: "Any JSON parser or browser",
    setup: "Open <strong>${fileName}</strong> in a browser or JSON viewer.",
    previewable: true,
  },
  png: {
    dependencies: "Any image viewer or browser",
    setup: "Open <strong>${fileName}</strong> in your browser or image viewer.",
    previewable: true,
  },
  jpg: {
    dependencies: "Any image viewer or browser",
    setup: "Open <strong>${fileName}</strong> in your browser or image viewer.",
    previewable: true,
  },
  gif: {
    dependencies: "Any image viewer or browser",
    setup: "Open <strong>${fileName}</strong> in your browser or image viewer.",
    previewable: true,
  },
  svg: {
    dependencies: "Any SVG-compatible browser or editor",
    setup: "Open <strong>${fileName}</strong> in your browser or SVG editor.",
    previewable: true,
  },
  webp: {
    dependencies: "Any WebP-compatible browser or viewer",
    setup: "Open <strong>${fileName}</strong> in your browser or image viewer.",
    previewable: true,
  },
  mp4: {
    dependencies: "Any video player or browser",
    setup: "Open <strong>${fileName}</strong> in your browser or video player.",
    previewable: true,
  },
  mp3: {
    dependencies: "Any audio player or browser",
    setup: "Open <strong>${fileName}</strong> in your browser or audio player.",
    previewable: true,
  },
  wav: {
    dependencies: "Any audio player or browser",
    setup: "Open <strong>${fileName}</strong> in your browser or audio player.",
    previewable: true,
  },
  exe: {
    dependencies: "Windows OS",
    setup: "Double-click <strong>${fileName}</strong> to run the executable.",
    previewable: false, // Future: pop-up tester
  },
  bat: {
    dependencies: "Windows OS",
    setup: "Double-click <strong>${fileName}</strong> to run the batch script.",
    previewable: true, // As text
  },
  zip: {
    dependencies: "Unzip tool (e.g., built-in OS unzip, 7-Zip)",
    setup: "Unzip the folder and follow the nested README instructions.",
    previewable: false, // Contents may be previewable
  },
};

// Zips files with a robust, flair-filled README
export async function zipFilesWithReadme(files, task) {
  const zip = new JSZip();
  let validFilesAdded = 0;
  const invalidFiles = [];

  // Validate files input
  if (!files || typeof files !== "object" || Object.keys(files).length === 0) {
    await error(`No files provided to zip for task "${task.taskId || "unknown"}"`);
    throw new Error("No files provided to zip");
  }

  // Process each file
  for (const [fileName, content] of Object.entries(files)) {
    if (typeof fileName !== "string" || !fileName.trim()) {
      invalidFiles.push({ fileName: fileName || "unnamed", reason: "Invalid or empty file name" });
      await error(`Invalid file name "${fileName}" in task "${task.taskId || "unknown"}"`);
      continue;
    }

    if (typeof content === "string") {
      try {
        zip.file(fileName, Buffer.from(content, "base64"));
        validFilesAdded++;
      } catch (e) {
        invalidFiles.push({ fileName, reason: `Failed to decode base64: ${e.message}` });
        await error(`Failed to decode base64 content for "${fileName}" in task "${task.taskId || "unknown"}": ${e.message}`);
      }
    } else if (Buffer.isBuffer(content)) {
      zip.file(fileName, content);
      validFilesAdded++;
    } else {
      invalidFiles.push({ fileName, reason: `Invalid content type: ${typeof content}` });
      await error(`Skipping invalid file content for "${fileName}" in task "${task.taskId || "unknown"}": ${typeof content}`);
    }
  }

  if (validFilesAdded === 0) {
    const errorMsg = `No valid files to zip for task "${task.taskId || "unknown"}". Invalid files: ${JSON.stringify(invalidFiles)}`;
    await error(errorMsg);
    throw new Error(errorMsg);
  }

  // Generate robust, flair-filled README
  const taskName = task.name || "Untitled Cosmic Creation";
  const taskFeatures = task.features || "Basic cosmic functionality";
  const taskType = task.type || "project";
  const isGame = taskFeatures.toLowerCase().includes("game") || taskType === "full stack";
  const fileList = Object.keys(files)
    .map((fileName) => {
      const ext = fileName.split(".").pop().toLowerCase();
      const info = fileTypeInfo[ext] || { dependencies: "Varies", setup: `Check ${fileName} for specific usage`, previewable: false };
      return `<li><strong>${fileName}</strong>: ${
        ext === "html"
          ? "Main webpage with neon animations and cosmic flair"
          : ext === "js" || ext === "jsx" || ext === "ts"
          ? "Interactive script with dynamic galactic effects"
          : ext === "vue"
          ? "Vue component with sleek, animated styling"
          : ext === "py"
          ? "Python script with cosmic logic"
          : ext === "php"
          ? "PHP page with server-side swagger"
          : ext === "rb"
          ? "Ruby script with ruby-red flair"
          : ext === "java"
          ? "Java app with robust cosmic structure"
          : ext === "cpp"
          ? "C++ code with high-performance flair"
          : ext === "go"
          ? "Go script with lightweight cosmic speed"
          : ext === "rs"
          ? "Rust code with iron-clad flair"
          : ext === "kt"
          ? "Kotlin app with mobile-ready vibes"
          : ext === "swift"
          ? "Swift code with Apple-flavored flair"
          : ext === "cs"
          ? "C# app with .NET cosmic power"
          : ext === "r"
          ? "R script with statistical swagger"
          : ext === "scala"
          ? "Scala code with functional flair"
          : ext === "dart"
          ? "Dart app with Flutter-ready vibes"
          : ext === "pl"
          ? "Perl script with retro cosmic charm"
          : ext === "lua"
          ? "Lua script with lightweight flair"
          : ext === "sh" || ext === "ps1"
          ? "Shell script with command-line cosmic action"
          : ext === "sql"
          ? "SQL script with database flair"
          : ext === "yaml" || ext === "xml" || ext === "toml"
          ? "Config file with structured cosmic data"
          : ext === "md"
          ? "Markdown doc with readable galactic prose"
          : ext === "Dockerfile"
          ? "Docker config for containerized cosmic deployment"
          : ext === "txt"
          ? "Plain text with cosmic notes"
          : ext === "csv"
          ? "Data table with cosmic organization"
          : ext === "json"
          ? "Structured data with cosmic hierarchy"
          : ext === "pdf"
          ? "Rich document with cosmic storytelling"
          : ext === "png" || ext === "jpg" || ext === "gif" || ext === "svg" || ext === "webp"
          ? "Visual masterpiece crafted with cosmic flair"
          : ext === "mp4"
          ? "Video with galactic motion"
          : ext === "mp3" || ext === "wav"
          ? "Audio with cosmic soundwaves"
          : ext === "exe"
          ? "Executable packed with cosmic power"
          : ext === "bat"
          ? "Batch script for quick cosmic action"
          : ext === "zip"
          ? "Nested cosmic bundle - unzip for more!"
          : "Supporting file for your galactic project"
      }${info.previewable ? "" : " <em>(Preview coming soon!)</em>"}</li>`;
    })
    .join("");

  const dependencies = [
    ...new Set(
      Object.keys(files).map((fileName) => {
        const ext = fileName.split(".").pop().toLowerCase();
        return fileTypeInfo[ext]?.dependencies || "Unknown dependency - check file type";
      })
    ),
  ].join("<br>");
  const setupInstructions = [
    ...new Set(
      Object.keys(files).map((fileName) => {
        const ext = fileName.split(".").pop().toLowerCase();
        return fileTypeInfo[ext]?.setup.replace("${fileName}", fileName).replace("${taskId}", task.taskId) || `Check ${fileName} for usage`;
      })
    ),
  ].join("<br>");

  const readmeContent = `
<!DOCTYPE html>
<html>
  <head>
    <title>${taskName} - Cracker Bot’s Cosmic Creation</title>
    <style>
      body {
        font-family: 'Courier New', monospace;
        background: linear-gradient(135deg, #1a1a1a, #2a2a4a);
        color: #00ff00;
        padding: 30px;
        margin: 0;
        animation: cosmicFade 2s infinite alternate;
      }
      h1 {
        font-size: 2.5em;
        text-shadow: 0 0 10px #ff00ff, 0 0 20px #00ffcc;
        text-align: center;
        margin-bottom: 20px;
      }
      h2 {
        font-size: 1.8em;
        color: #ff00ff;
        text-shadow: 0 0 5px #ff00ff;
        margin-top: 20px;
      }
      p, li {
        line-height: 1.8;
        font-size: 1.1em;
      }
      ul {
        list-style: none;
        padding-left: 0;
      }
      li:before {
        content: ">> ";
        color: #00ffcc;
      }
      em {
        color: #ff007a;
        font-style: italic;
      }
      footer {
        margin-top: 40px;
        font-size: 0.9em;
        color: #00cc00;
        text-align: center;
        border-top: 1px solid #ff00ff;
        padding-top: 10px;
      }
      a {
        color: #00ff99;
        text-decoration: none;
        transition: all 0.3s;
      }
      a:hover {
        text-shadow: 0 0 5px #00ff99;
        text-decoration: underline;
      }
      code {
        background: #0a0a23;
        padding: 2px 6px;
        border-radius: 4px;
        color: #ff007a;
      }
      @keyframes cosmicFade {
        from { opacity: 0.9; }
        to { opacity: 1; }
      }
    </style>
  </head>
  <body>
    <h1>${taskName}</h1>
    <p>Welcome to your Cracker Bot masterpiece, ${task.user || "cosmic coder"}! This ZIP is a galactic bundle of awesomeness, crafted with your features: "${taskFeatures}". Unzip and dive into the cosmic chaos!</p>
    <h2>Files</h2>
    <ul>${fileList}</ul>
    <h2>Dependencies</h2>
    <p>Get these cosmic tools ready:<br>${dependencies}</p>
    <h2>How to Set Up & Run</h2>
    <p>
      ${isGame
        ? `Unzip this bad boy and blast off! For web-based games or apps, open <strong>index-${task.taskId}.html</strong> in your browser. On Windows? Double-click <strong>run-${task.taskId}.bat</strong> to launch with flair!`
        : "Unzip and follow these steps to unleash your project:"}
      <br>${setupInstructions}
    </p>
    <h2>Tips from Cracker Bot</h2>
    <p>Want to tweak this? Hit "Refine Project" in the chat. Lost in space? Scope <a href="https://github.com/chefken052580/cracker-bot">Cracker Bot’s GitHub</a> or type <code>/guide</code>. Keep it slick, fam!</p>
    <footer>
      Forged by Cracker Bot - <a href="https://github.com/chefken052580/cracker-bot">GitHub</a><br>
      Timestamp: ${new Date().toISOString()} - Cosmic vibes delivered for ${task.user || "you"}!
    </footer>
  </body>
</html>`;

  zip.file("readme.html", readmeContent);

  // Add Windows run script for games or full-stack projects
  if (isGame) {
    const runBat = `@echo off\r\nstart "" "index-${task.taskId}.html"\r\necho Launched ${taskName} - Cracker Bot’s cosmic creation for ${task.user || "you"}!\r\npause`;
    zip.file(`run-${task.taskId}.bat`, runBat);
  }

  try {
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    await log(`Generated zip for task "${task.taskId || "unknown"}" (${taskName}) with files: ${Object.keys(files).join(", ")}`);
    return buffer;
  } catch (e) {
    const errorMsg = `Failed to generate zip for task "${task.taskId || "unknown"}": ${e.message}. Invalid files: ${JSON.stringify(invalidFiles)}`;
    await error(errorMsg);

    if (validFilesAdded > 0) {
      const firstValidFile = Object.entries(files).find(([_, content]) => typeof content === "string" || Buffer.isBuffer(content));
      if (firstValidFile) {
        await log(`Falling back to single file "${firstValidFile[0]}" for task "${task.taskId || "unknown"}"`);
        return typeof firstValidFile[1] === "string" ? Buffer.from(firstValidFile[1], "base64") : firstValidFile[1];
      }
    }
    throw new Error(errorMsg);
  }
}
import * as vscode from "vscode";

export function activate(context) {
  const openWelcome = async () => {
    let workspaceFolder;
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      try {
        await vscode.workspace.fs.stat(
          vscode.Uri.joinPath(folder.uri, "public", "flashmonkey-welcome.mp4")
        );
        workspaceFolder = folder;
        break;
      } catch (error) {
        if (error?.code !== "FileNotFound" && error?.code !== "FileNotADirectory") {
          console.error("No se pudo verificar el video de bienvenida:", error);
          void vscode.window.showErrorMessage(
            "No se pudo comprobar el video de bienvenida de FlashMonkey."
          );
          return;
        }
      }
    }

    if (!workspaceFolder) {
      void vscode.window.showWarningMessage(
        "No se encontró public/flashmonkey-welcome.mp4 en el workspace abierto."
      );
      return;
    }

    const publicDirectory = vscode.Uri.joinPath(workspaceFolder.uri, "public");
    const videoUri = vscode.Uri.joinPath(publicDirectory, "flashmonkey-welcome.mp4");
    const posterUri = vscode.Uri.joinPath(publicDirectory, "flashmonkey-logo.png");
    const styleUri = vscode.Uri.joinPath(context.extensionUri, "media", "welcome.css");
    const scriptUri = vscode.Uri.joinPath(context.extensionUri, "media", "welcome.js");
    const panel = vscode.window.createWebviewPanel(
      "flashmonkeyVideoWelcome",
      "FlashMonkey",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          publicDirectory,
          vscode.Uri.joinPath(context.extensionUri, "media")
        ]
      }
    );

    panel.webview.html = createWelcomeHtml(
      panel.webview,
      videoUri,
      posterUri,
      styleUri,
      scriptUri
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("flashmonkey-video-welcome.openWelcome", openWelcome)
  );

  openWelcome();
}

function createWelcomeHtml(webview, videoUri, posterUri, styleUri, scriptUri) {
  const videoSource = webview.asWebviewUri(videoUri);
  const posterSource = webview.asWebviewUri(posterUri);
  const styleSource = webview.asWebviewUri(styleUri);
  const scriptSource = webview.asWebviewUri(scriptUri);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${webview.cspSource}; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <title>FlashMonkey</title>
    <link rel="stylesheet" href="${styleSource}">
    <script defer src="${scriptSource}"></script>
  </head>
  <body>
    <main>
      <img class="logo" src="${posterSource}" alt="FlashMonkey">
      <video id="welcome-video" src="${videoSource}" poster="${posterSource}" loop muted playsinline controls>
        Tu navegador no admite la reproducción de video.
      </video>
      <p>Bienvenido a FlashMonkey</p>
    </main>
  </body>
</html>`;
}

export function deactivate() {}

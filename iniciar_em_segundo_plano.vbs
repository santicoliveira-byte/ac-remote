' AC Remote - Iniciar Servidor em Segundo Plano (Silencioso / Sem Janela)
' Executa o servidor AC Remote de forma invisivel sem abrir a janela da consola.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = scriptDir
' O parametro 0 executa o comando totalmente oculto (sem janela)
WshShell.Run "cmd.exe /c start_ac_remote.bat", 0, False

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"

; ── Variables for the DB path page ──────────────────────────────
Var DbPathDialog
Var DbPathTextBox
Var DbPathBrowseBtn
Var DbPathValue

; ── Page: create UI ─────────────────────────────────────────────
Function dbPathPageCreate
  !insertmacro MUI_HEADER_TEXT "Percorso Database" "Seleziona il percorso in cui si trova il database"

  nsDialogs::Create 1018
  Pop $DbPathDialog

  ${If} $DbPathDialog == error
    Abort
  ${EndIf}

  ; Description label
  ${NSD_CreateLabel} 0 0 100% 36u "Inserisci il percorso della cartella contenente il database (percorso locale o di rete).$\r$\nIl file database.sqlite deve essere già presente nel percorso selezionato."
  Pop $0

  ; Path text input
  ${NSD_CreateText} 0 50u 77% 12u "$DbPathValue"
  Pop $DbPathTextBox

  ; Browse button
  ${NSD_CreateButton} 80% 49u 20% 14u "Sfoglia..."
  Pop $DbPathBrowseBtn
  ${NSD_OnClick} $DbPathBrowseBtn dbPathBrowse

  nsDialogs::Show
FunctionEnd

; ── Browse button callback ──────────────────────────────────────
Function dbPathBrowse
  nsDialogs::SelectFolderDialog "Seleziona la cartella del database" ""
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $DbPathTextBox "$0"
  ${EndIf}
FunctionEnd

; ── Page: validate on leave ─────────────────────────────────────
Function dbPathPageLeave
  ${NSD_GetText} $DbPathTextBox $DbPathValue

  ; Path must not be empty
  ${If} $DbPathValue == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Inserisci un percorso per il database."
    Abort
  ${EndIf}

  ; database.sqlite must already exist at the chosen path
  ${IfNot} ${FileExists} "$DbPathValue\database.sqlite"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Il file 'database.sqlite' non è stato trovato in:$\n$\n$DbPathValue$\n$\nSeleziona un percorso valido contenente il database."
    Abort
  ${EndIf}
FunctionEnd

; ── Register the custom page (shown after the install-dir page) ─
!macro customPageAfterChangeDir
  Page custom dbPathPageCreate dbPathPageLeave
!macroend

; ── After installation: write db-config.json ────────────────────
!macro customInstall
  ; Build full path and convert backslashes to forward slashes for JSON safety
  StrCpy $R0 "$DbPathValue\database.sqlite"
  ${WordReplace} $R0 "\" "/" "+" $R1

  FileOpen $0 "$INSTDIR\db-config.json" w
  FileWrite $0 '{$\r$\n  "dbPath": "$R1"$\r$\n}'
  FileClose $0
!macroend

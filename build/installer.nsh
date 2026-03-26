!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"

!ifndef BUILD_UNINSTALLER

; ── Variables for the DB path page ──────────────────────────────
Var DbPathDialog
Var DbPathTextBox
Var DbPathBrowseBtn
Var DbPathValue
Var DbConfigExists

; ── Helper: read dbPath from existing db-config.json ────────────
; Reads the file line by line looking for "dbPath" and extracts the value.
; Result stored in $DbPathValue. If file doesn't exist, $DbPathValue stays empty.
Function readExistingDbPath
  StrCpy $DbConfigExists "0"
  StrCpy $DbPathValue ""

  ${IfNot} ${FileExists} "$APPDATA\${APP_PACKAGE_NAME}\db-config.json"
    Return
  ${EndIf}

  StrCpy $DbConfigExists "1"

  FileOpen $0 "$APPDATA\${APP_PACKAGE_NAME}\db-config.json" r

  readLoop:
    FileRead $0 $1
    ${If} $1 == ""
      Goto readDone
    ${EndIf}

    ; Check if this line contains "dbPath"
    ${WordFind} $1 '"dbPath"' "E+1{" $2
    ${If} $2 != $1
      ; Found dbPath line — extract value between quotes after the colon
      ; Line format:   "dbPath": "some/path/database.sqlite"
      ; Extract everything after the first colon
      ${WordFind} $1 ":" "+1}" $3
      ; Strip line-ending characters
      ${WordReplace} $3 '$\r' "" "+" $3
      ${WordReplace} $3 '$\n' "" "+" $3
      ; Extract the value between the double quotes (preserves spaces in paths)
      ${WordFind} $3 '"' "+2" $3
      ; Remove the trailing "database.sqlite" to get just the folder path
      ${WordReplace} $3 "/database.sqlite" "" "+" $3
      ${WordReplace} $3 "\database.sqlite" "" "+" $3
      ; Convert forward slashes to backslashes for Windows display
      ${WordReplace} $3 "/" "\" "+" $3
      StrCpy $DbPathValue $3
      Goto readDone
    ${EndIf}

    Goto readLoop

  readDone:
  FileClose $0
FunctionEnd

; ── Page: create UI ─────────────────────────────────────────────
Function dbPathPageCreate
  ; Pre-fill from existing config if available
  Call readExistingDbPath

  nsDialogs::Create 1018
  Pop $DbPathDialog

  ${If} $DbPathDialog == error
    Abort
  ${EndIf}

  ; Description label
  ${NSD_CreateLabel} 0 0 100% 36u "Inserisci il percorso della cartella contenente il database (percorso locale o di rete).$\r$\nIl file database.sqlite deve essere già presente nel percorso selezionato."
  Pop $0

  ; Path text input (pre-filled if config exists)
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
  nsDialogs::SelectFolderDialog "Seleziona la cartella del database" "$DbPathValue"
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

; ── After installation: write/update db-config.json ─────────────
; Scrive sempre un file minimale con il solo dbPath.
; ConfigService fa shallow merge con i defaults alla lettura,
; quindi eventuali altri campi vengono ripristinati automaticamente.
!macro customInstall
  ; In silent mode (auto-update) preserve the existing db-config.json
  ${IfNot} ${Silent}
    ; Build full path and convert backslashes to forward slashes for JSON
    StrCpy $R0 "$DbPathValue\database.sqlite"
    ${WordReplace} $R0 "\" "/" "+" $R1

    CreateDirectory "$APPDATA\${APP_PACKAGE_NAME}"

    FileOpen $0 "$APPDATA\${APP_PACKAGE_NAME}\db-config.json" w
    FileWrite $0 '{$\r$\n  "dbPath": "$R1"$\r$\n}'
    FileClose $0
  ${EndIf}
!macroend

!endif ; BUILD_UNINSTALLER

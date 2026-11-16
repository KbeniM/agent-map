@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rancher-hook.ps1" %*

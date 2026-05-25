// Package main is the entry point for the Multi-Database Browsing desktop application.
// It initializes the Wails runtime with the backend App and embedded frontend assets.
package main

import (
	"embed"

	backendapp "multi-database-browsing/backend/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:dist
var assets embed.FS

func main() {
	app := backendapp.NewApp()

	err := wails.Run(&options.App{
		Title:  "Multi-Database Browsing",
		Width:  1200,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.Startup,
		OnShutdown: app.Shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		panic(err)
	}
}

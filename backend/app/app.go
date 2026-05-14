package app

import (
	"context"

	state_store "multi-database-browsing/backend/infra/state_store"
	esmodule "multi-database-browsing/backend/modules/elasticsearch"
	mysqlmodule "multi-database-browsing/backend/modules/mysql"
	redismodule "multi-database-browsing/backend/modules/redis"
)

// App is the top-level application struct bound to the Wails frontend.
// It holds references to all database modules and the state store,
// and exposes methods that the frontend can invoke via Wails IPC.
type App struct {
	ctx           context.Context
	elasticsearch *esmodule.Module
	stateStore    *state_store.AppStateStore
	mysql         *mysqlmodule.Module
	redis         *redismodule.Module
}

// NewApp creates a new App instance with initialized database modules and state store.
// Call Startup(ctx) after creation to set the Wails application context.
func NewApp() *App {
	mysqlModule := mysqlmodule.NewModule()
	redisModule := redismodule.NewModule()

	return &App{
		elasticsearch: esmodule.NewModule(),
		stateStore:    state_store.NewAppStateStore("multi-database-browsing"),
		mysql:         mysqlModule,
		redis:         redisModule,
	}
}

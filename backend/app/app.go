package app

import (
	"context"

	state_store "multi-database-browsing/backend/infra/state_store"
	esmodule "multi-database-browsing/backend/modules/elasticsearch"
	mysqlmodule "multi-database-browsing/backend/modules/mysql"
	redismodule "multi-database-browsing/backend/modules/redis"
)

type App struct {
	ctx           context.Context
	elasticsearch *esmodule.Module
	stateStore    *state_store.AppStateStore
	mysql         *mysqlmodule.Module
	redis         *redismodule.Module
}

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

package backend

import (
	"context"
)

// App struct
type App struct {
	ctx           context.Context
	elasticsearch *ElasticsearchModule
	stateStore    *AppStateStore
	mysql         *MysqlModule
	redis         *RedisModule
}

// NewApp creates a new App application struct
func NewApp() *App {
	mysqlModule := NewMysqlModule()
	redisModule := NewRedisModule()

	return &App{
		elasticsearch: NewElasticsearchModule(),
		stateStore:    NewAppStateStore("multi-database-browsing"),
		mysql:         mysqlModule,
		redis:         redisModule,
	}
}

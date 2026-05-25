package app

import (
	"context"
	"fmt"
)

func (a *App) Startup(ctx context.Context) {
	a.startup(ctx)
}

func (a *App) Shutdown(ctx context.Context) {
	a.shutdown(ctx)
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fmt.Println("Application started")
}

func (a *App) shutdown(ctx context.Context) {
	a.mysql.CloseAll()
	a.redis.CloseAll()
	fmt.Println("Application shutdown")
}

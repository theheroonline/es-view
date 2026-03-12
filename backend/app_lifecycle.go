package backend

import (
	"context"
	"fmt"
)

// startup is called at application startup
func (a *App) Startup(ctx context.Context) {
	a.startup(ctx)
}

// Shutdown is called at application shutdown
func (a *App) Shutdown(ctx context.Context) {
	a.shutdown(ctx)
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fmt.Println("Application started")
}

// shutdown is called at application shutdown
func (a *App) shutdown(ctx context.Context) {
	a.mysql.CloseAll()
	a.redis.CloseAll()
	fmt.Println("Application shutdown")
}

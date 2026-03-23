package app

func (a *App) LoadState() (string, error) {
	return a.stateStore.LoadState()
}

func (a *App) SaveState(data string) error {
	return a.stateStore.SaveState(data)
}

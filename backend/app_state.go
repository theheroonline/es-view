package backend

// LoadState loads application state from file
func (a *App) LoadState() (string, error) {
	return a.stateStore.LoadState()
}

// SaveState saves application state to file
func (a *App) SaveState(data string) error {
	return a.stateStore.SaveState(data)
}

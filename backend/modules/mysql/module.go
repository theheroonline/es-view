package mysql

type Module struct {
	connManager *MysqlConnectionManager
	transfer    *TransferService
}

func NewModule() *Module {
	module := &Module{connManager: NewMysqlConnectionManager()}
	module.transfer = NewTransferService(module)
	return module
}

func (m *Module) CloseAll() {
	m.connManager.CloseAll()
}

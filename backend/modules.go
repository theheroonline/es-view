package backend

type MysqlModule struct {
	connManager *MysqlConnectionManager
	transfer    *MysqlTransferService
}

func NewMysqlModule() *MysqlModule {
	module := &MysqlModule{
		connManager: NewMysqlConnectionManager(),
	}
	module.transfer = NewMysqlTransferService(module)
	return module
}

func (m *MysqlModule) CloseAll() {
	m.connManager.CloseAll()
}

type RedisModule struct {
	connManager *RedisConnectionManager
}

func NewRedisModule() *RedisModule {
	return &RedisModule{
		connManager: NewRedisConnectionManager(),
	}
}

func (m *RedisModule) CloseAll() {
	m.connManager.CloseAll()
}

type ElasticsearchModule struct{}

func NewElasticsearchModule() *ElasticsearchModule {
	return &ElasticsearchModule{}
}

type AppStateStore struct {
	appName string
}

func NewAppStateStore(appName string) *AppStateStore {
	return &AppStateStore{appName: appName}
}

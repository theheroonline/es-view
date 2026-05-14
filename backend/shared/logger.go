package shared

import (
	"io"
	"log/slog"
	"os"
)

// Logger is the application-wide structured logger.
// All backend modules should use this instead of log.Printf or fmt.Println.
var Logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
	Level: slog.LevelInfo,
}))

// SetOutput redirects log output to the given writer (useful for tests).
func SetOutput(w io.Writer) {
	Logger = slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
}

// Engine-scoped logger helpers.
func LoggerFor(engine string) *slog.Logger {
	return Logger.With(slog.String("engine", engine))
}

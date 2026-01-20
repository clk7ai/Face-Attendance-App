import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, countdown: 5 };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log to console
        console.error("Uncaught error:", error, errorInfo);

        // Log to Server
        fetch('http://localhost:3001/api/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: error.toString(),
                errorInfo: errorInfo
            })
        }).catch(err => console.error("Failed to send log to server", err));

        // Start restart countdown
        this.interval = setInterval(() => {
            this.setState(prevState => {
                if (prevState.countdown <= 1) {
                    clearInterval(this.interval);
                    window.location.reload(); // Restart app
                    return { countdown: 0 };
                }
                return { countdown: prevState.countdown - 1 };
            });
        }, 1000);
    }

    componentWillUnmount() {
        if (this.interval) clearInterval(this.interval);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6 text-center">
                    <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-2xl max-w-md w-full shadow-2xl backdrop-blur-sm">
                        <h1 className="text-3xl font-bold text-red-400 mb-4">Application Crashed</h1>
                        <p className="text-gray-300 mb-6">
                            An unexpected error occurred. Use the server logs to debug this.
                        </p>

                        <div className="text-4xl font-mono font-bold text-blue-400 mb-6">
                            Restarting in {this.state.countdown}s
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Restart Now
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;


import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { LOADING_MESSAGES } from '../constants';

const LoadingScreen: React.FC = () => {
    const { state } = useContext(AppContext);
    const [message, setMessage] = useState(LOADING_MESSAGES[0]);

    useEffect(() => {
        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
            setMessage(LOADING_MESSAGES[randomIndex]);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center animate-fade-in">
            <div className="w-24 h-24 border-8 border-dashed rounded-full animate-spin border-orange-400 mb-8"></div>
            <h2 className="font-display text-4xl text-cyan-500 mb-4">{state.loadingMessage}</h2>
            <p className="font-body text-xl text-gray-600 transition-opacity duration-500">{message}</p>
        </div>
    );
}

export default LoadingScreen;

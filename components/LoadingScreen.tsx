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
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    const animationStyles = `
        .scene {
            perspective: 1000px;
            width: 280px;
            height: 320px;
        }
        .banana-container {
            width: 100%;
            height: 100%;
            position: relative;
            transform-style: preserve-3d;
            animation: spin 8s infinite ease-in-out;
            clip-path: url(#banana-clip);
            -webkit-clip-path: url(#banana-clip);
        }
        .banana-body, .peel, .book-reveal {
            position: absolute;
            width: 100%;
            height: 100%;
        }
        .banana-body {
            background: linear-gradient(160deg, #FDE047, #FBBF24);
            transform: translateZ(-20px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .peel {
            transform-origin: left center;
            transform-style: preserve-3d;
            animation: peel 8s infinite ease-in-out;
        }
        .peel-face {
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden; /* Safari */
            overflow: hidden;
        }
        .peel-front {
            background: linear-gradient(160deg, #FDE047, #FBBF24);
        }
        .peel-back {
            background: #F5F5DC; /* Beige - inside of peel */
            transform: rotateY(180deg);
        }
        .book-reveal {
            background-color: #A0522D;
            padding: 20px;
            box-shadow: inset 0 0 15px rgba(0,0,0,0.4);
            transform: translateZ(-19px) scale(0.95);
            opacity: 0;
            animation: reveal 8s infinite ease-in-out;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .book-spine {
            position: absolute;
            left: -15px;
            top: 10px;
            bottom: 10px;
            width: 20px;
            background-color: #8B4513;
            border-radius: 5px 0 0 5px;
            box-shadow: inset 3px 0 5px rgba(0,0,0,0.3);
        }
        .book-title {
            color: #FFF8DC;
            font-size: 2rem;
            line-height: 1.2;
            text-align: center;
            text-shadow: 2px 2px 3px rgba(0,0,0,0.4);
            padding: 0 10px;
        }

        @keyframes spin {
            0%, 100% { transform: rotateY(0deg); }
            50% { transform: rotateY(25deg); }
        }

        @keyframes peel {
            0%, 20%, 80%, 100% { transform: rotateY(0deg); }
            40%, 60% { transform: rotateY(160deg) translateX(30px) translateZ(50px); }
        }
        
        @keyframes reveal {
            0%, 25%, 75%, 100% { opacity: 0; transform: translateZ(-19px) scale(0.95); }
            40%, 60% { opacity: 1; transform: translateZ(0px) scale(1); }
        }
    `;

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center animate-fade-in">
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                    <clipPath id="banana-clip" clipPathUnits="objectBoundingBox">
                        <path d="M0.1,0.8 C0.25,0.2 0.75,0.1 0.95,0.5 C0.8,0.8 0.5,1 0.1,0.8 Z"></path>
                    </clipPath>
                </defs>
            </svg>
            <style>{animationStyles}</style>
            <div className="scene mb-8">
                <div className="banana-container">
                    <div className="banana-body"></div>
                    <div className="book-reveal">
                        <div className="book-spine"></div>
                        <h3 className="font-display book-title">Once<br/>Upon a<br/>Banana</h3>
                    </div>
                    <div className="peel">
                        <div className="peel-face peel-front"></div>
                        <div className="peel-face peel-back"></div>
                    </div>
                </div>
            </div>
            <h2 className="font-display text-4xl text-cyan-500 mb-4">{state.loadingMessage}</h2>
            <p className="font-body text-xl text-gray-600 transition-opacity duration-500">{message}</p>
        </div>
    );
};

export default LoadingScreen;
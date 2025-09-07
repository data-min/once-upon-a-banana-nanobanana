import React from 'react';
import Button from './Button';

interface SafetyWarningModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

const SafetyWarningModal: React.FC<SafetyWarningModalProps> = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-amber-50 rounded-2xl p-8 max-w-lg w-full shadow-2xl border-4 border-white">
                <h3 className="font-display text-4xl text-orange-500 mb-4 text-center">Video Generation Tips</h3>
                <p className="font-body text-gray-700 mb-6 text-left">
                    The video creation AI works best with simple, positive prompts. It can be very strict and might fail with:
                </p>
                <ul className="list-disc list-inside font-body text-gray-700 mb-6 space-y-2 text-left">
                    <li>Scenes with people, especially children.</li>
                    <li>Strong emotion words (e.g., sad, scared, cry).</li>
                    <li>Common fantasy creatures (e.g., monster, ghost, dragon).</li>
                    <li>Dark or nighttime settings.</li>
                    <li>Ambiguous phrases (e.g., "he looked," "fell," "ran fast").</li>
                </ul>
                <p className="font-body text-gray-600 text-sm text-left">
                    If video generation fails, try revising the page text to be simpler and more direct.
                </p>
                <div className="flex justify-center gap-4 mt-8">
                    <Button onClick={onCancel} variant="secondary">Cancel</Button>
                    <Button onClick={onConfirm}>Understood, Continue</Button>
                </div>
            </div>
        </div>
    );
};

export default SafetyWarningModal;

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import type { AppContextType, HealthData, StandardPattern, DailyData, User, UserDataBundle } from '../types';
import * as GoogleDriveService from '../services/googleDriveService';

const AppContext = createContext<AppContextType | undefined>(undefined);

type AppProviderProps = {
    children: ReactNode;
};

const defaultUserData: UserDataBundle = {
    healthData: {},
    medications: ['Medicina A', 'Medicina B'],
    standardPattern: {}
};

export const AppProvider = ({ children }: AppProviderProps) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserDataBundle>(defaultUserData);
    const [isLoading, setIsLoading] = useState(true);
    const [isGapiLoaded, setIsGapiLoaded] = useState(false);

    const saveDataToDrive = useCallback(async (data: UserDataBundle) => {
        try {
            await GoogleDriveService.saveData(data);
        } catch (error) {
            console.error("Failed to save data to drive", error);
            // Handle error, maybe show a toast to the user
        }
    }, []);

    const updateAndSaveUserData = (updater: (prev: UserDataBundle) => UserDataBundle) => {
        setUserData(prev => {
            const newState = updater(prev);
            saveDataToDrive(newState);
            return newState;
        });
    };

    const handleAuthChange = useCallback(async (isSignedIn: boolean) => {
        if (isSignedIn) {
            const profile = GoogleDriveService.getUserProfile();
            if (profile) {
                setCurrentUser({
                    username: profile.getName(),
                    email: profile.getEmail(),
                    picture: profile.getImageUrl(),
                });
                try {
                    const data = await GoogleDriveService.loadData(defaultUserData);
                    setUserData(data);
                } catch (error) {
                    console.error("Failed to load data from drive", error);
                    setUserData(defaultUserData); // Fallback to default
                }
            }
        } else {
            setCurrentUser(null);
            setUserData(defaultUserData);
        }
        setIsLoading(false);
    }, []);
    
    useEffect(() => {
        const initGoogleClient = async () => {
            await GoogleDriveService.initGoogleClient(handleAuthChange);
            setIsGapiLoaded(true);
        };
        // Use a flag in window to prevent double-initialization in strict mode
        if (!(window as any).gapiInitialized) {
            (window as any).gapiInitialized = true;
            initGoogleClient();
        }
    }, [handleAuthChange]);


    const login = () => {
        GoogleDriveService.signIn();
    };

    const logout = () => {
        GoogleDriveService.signOut();
    };

    const updateHealthData = async (date: string, data: DailyData) => {
        updateAndSaveUserData(prev => ({
            ...prev,
            healthData: { ...prev.healthData, [date]: data }
        }));
    };

    const addMedication = async (med: string) => {
        if (!userData.medications.includes(med)) {
            updateAndSaveUserData(prev => ({
                ...prev,
                medications: [...prev.medications, med].sort()
            }));
        }
    };

    const editMedication = async (oldMed: string, newMed: string) => {
        updateAndSaveUserData(prev => {
            const newHealthData: HealthData = {};
            for (const date in prev.healthData) {
                newHealthData[date] = {};
                for (const time in prev.healthData[date]) {
                    newHealthData[date][time] = {
                        ...prev.healthData[date][time],
                        medications: prev.healthData[date][time].medications.map(m => (m === oldMed ? newMed : m))
                    };
                }
            }

            const newStandardPattern: StandardPattern = {};
            for (const time in prev.standardPattern) {
                newStandardPattern[time] = prev.standardPattern[time].map(m => (m === oldMed ? newMed : m));
            }
            
            return {
                ...prev,
                medications: prev.medications.map(m => (m === oldMed ? newMed : m)).sort(),
                healthData: newHealthData,
                standardPattern: newStandardPattern
            };
        });
    };

    const deleteMedication = async (medToDelete: string) => {
         updateAndSaveUserData(prev => {
            const newHealthData: HealthData = {};
            for (const date in prev.healthData) {
                newHealthData[date] = {};
                for (const time in prev.healthData[date]) {
                    newHealthData[date][time] = {
                        ...prev.healthData[date][time],
                        medications: prev.healthData[date][time].medications.filter(m => m !== medToDelete)
                    };
                }
            }
            
            const newStandardPattern: StandardPattern = {};
            for (const time in prev.standardPattern) {
                const filteredMeds = prev.standardPattern[time].filter(m => m !== medToDelete);
                if (filteredMeds.length > 0) {
                    newStandardPattern[time] = filteredMeds;
                }
            }
            
            return {
                ...prev,
                medications: prev.medications.filter(m => m !== medToDelete),
                healthData: newHealthData,
                standardPattern: newStandardPattern
            };
        });
    };
    
    const updateStandardPattern = async (pattern: StandardPattern) => {
        updateAndSaveUserData(prev => ({
            ...prev,
            standardPattern: pattern
        }));
    };
    
    const value: AppContextType = {
        currentUser,
        login,
        logout,
        healthData: userData.healthData,
        medications: userData.medications,
        standardPattern: userData.standardPattern,
        isLoading: isLoading || !isGapiLoaded,
        updateHealthData,
        addMedication,
        editMedication,
        deleteMedication,
        updateStandardPattern,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
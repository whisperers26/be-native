import { Navigate } from 'react-router-dom';

import Translate from '../pages/Translate';
import Recognize from '../pages/Recognize';
import Writing from '../pages/Writing';
import General from '../pages/General';
import Service from '../pages/Service';
import History from '../pages/History';
import Hotkey from '../pages/Hotkey';
import About from '../pages/About';

const routes = [
    {
        path: '/general',
        element: <General />,
    },
    {
        path: '/translate',
        element: <Translate />,
    },
    {
        path: '/writing',
        element: <Writing />,
    },
    {
        path: '/recognize',
        element: <Recognize />,
    },
    {
        path: '/hotkey',
        element: <Hotkey />,
    },
    {
        path: '/service',
        element: <Service />,
    },
    {
        path: '/history',
        element: <History />,
    },
    {
        path: '/about',
        element: <About />,
    },
    {
        path: '/',
        element: <Navigate to='/general' />,
    },
];

export default routes;

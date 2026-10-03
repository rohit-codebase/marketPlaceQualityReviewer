import { createBrowserRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import Dashboard from '../pages/Dashboard';
import Listings from '../pages/Listings';
import CreateListing from '../pages/CreateListing';
import ListingReview from '../pages/ListingReview';
import ReviewHistory from '../pages/ReviewHistory';
import BatchReview from '../pages/BatchReview';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout><Dashboard /></Layout>,
  },
  {
    path: '/listings',
    element: <Layout><Listings /></Layout>,
  },
  {
    path: '/listings/new',
    element: <Layout><CreateListing /></Layout>,
  },
  {
    path: '/listings/:id',
    element: <Layout><Listings /></Layout>,
  },
  {
    path: '/reviews/:id',
    element: <Layout><ListingReview /></Layout>,
  },
  {
    path: '/history',
    element: <Layout><ReviewHistory /></Layout>,
  },
  {
    path: '/batch',
    element: <Layout><BatchReview /></Layout>,
  },
]);

export default router;

import {
  UseDataConnectMutationResult,
  UseDataConnectQueryResult,
  useDataConnectMutationOptions,
  useDataConnectQueryOptions,
} from '@tanstack-query-firebase/react/data-connect';
import { FirebaseError } from 'firebase/app';
import { DataConnect } from 'firebase/data-connect';
import {
  AddReviewData,
  AddReviewVariables,
  CreateMovieData,
  CreateMovieVariables,
  DeleteReviewData,
  DeleteReviewVariables,
  GetMovieByIdData,
  GetMovieByIdVariables,
  ListMoviesData,
  ListUserReviewsData,
  ListUsersData,
  SearchMovieData,
  SearchMovieVariables,
  UpsertUserData,
  UpsertUserVariables,
} from '../';

export function useCreateMovie(
  options?: useDataConnectMutationOptions<
    CreateMovieData,
    FirebaseError,
    CreateMovieVariables
  >,
): UseDataConnectMutationResult<CreateMovieData, CreateMovieVariables>;
export function useCreateMovie(
  dc: DataConnect,
  options?: useDataConnectMutationOptions<
    CreateMovieData,
    FirebaseError,
    CreateMovieVariables
  >,
): UseDataConnectMutationResult<CreateMovieData, CreateMovieVariables>;

export function useUpsertUser(
  options?: useDataConnectMutationOptions<
    UpsertUserData,
    FirebaseError,
    UpsertUserVariables
  >,
): UseDataConnectMutationResult<UpsertUserData, UpsertUserVariables>;
export function useUpsertUser(
  dc: DataConnect,
  options?: useDataConnectMutationOptions<
    UpsertUserData,
    FirebaseError,
    UpsertUserVariables
  >,
): UseDataConnectMutationResult<UpsertUserData, UpsertUserVariables>;

export function useAddReview(
  options?: useDataConnectMutationOptions<
    AddReviewData,
    FirebaseError,
    AddReviewVariables
  >,
): UseDataConnectMutationResult<AddReviewData, AddReviewVariables>;
export function useAddReview(
  dc: DataConnect,
  options?: useDataConnectMutationOptions<
    AddReviewData,
    FirebaseError,
    AddReviewVariables
  >,
): UseDataConnectMutationResult<AddReviewData, AddReviewVariables>;

export function useDeleteReview(
  options?: useDataConnectMutationOptions<
    DeleteReviewData,
    FirebaseError,
    DeleteReviewVariables
  >,
): UseDataConnectMutationResult<DeleteReviewData, DeleteReviewVariables>;
export function useDeleteReview(
  dc: DataConnect,
  options?: useDataConnectMutationOptions<
    DeleteReviewData,
    FirebaseError,
    DeleteReviewVariables
  >,
): UseDataConnectMutationResult<DeleteReviewData, DeleteReviewVariables>;

export function useListMovies(
  options?: useDataConnectQueryOptions<ListMoviesData>,
): UseDataConnectQueryResult<ListMoviesData, undefined>;
export function useListMovies(
  dc: DataConnect,
  options?: useDataConnectQueryOptions<ListMoviesData>,
): UseDataConnectQueryResult<ListMoviesData, undefined>;

export function useListUsers(
  options?: useDataConnectQueryOptions<ListUsersData>,
): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(
  dc: DataConnect,
  options?: useDataConnectQueryOptions<ListUsersData>,
): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useListUserReviews(
  options?: useDataConnectQueryOptions<ListUserReviewsData>,
): UseDataConnectQueryResult<ListUserReviewsData, undefined>;
export function useListUserReviews(
  dc: DataConnect,
  options?: useDataConnectQueryOptions<ListUserReviewsData>,
): UseDataConnectQueryResult<ListUserReviewsData, undefined>;

export function useGetMovieById(
  vars: GetMovieByIdVariables,
  options?: useDataConnectQueryOptions<GetMovieByIdData>,
): UseDataConnectQueryResult<GetMovieByIdData, GetMovieByIdVariables>;
export function useGetMovieById(
  dc: DataConnect,
  vars: GetMovieByIdVariables,
  options?: useDataConnectQueryOptions<GetMovieByIdData>,
): UseDataConnectQueryResult<GetMovieByIdData, GetMovieByIdVariables>;

export function useSearchMovie(
  vars?: SearchMovieVariables,
  options?: useDataConnectQueryOptions<SearchMovieData>,
): UseDataConnectQueryResult<SearchMovieData, SearchMovieVariables>;
export function useSearchMovie(
  dc: DataConnect,
  vars?: SearchMovieVariables,
  options?: useDataConnectQueryOptions<SearchMovieData>,
): UseDataConnectQueryResult<SearchMovieData, SearchMovieVariables>;

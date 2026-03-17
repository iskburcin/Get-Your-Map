/**
 * Profile type for storing the profile of the user.
 * @property {string} login - The login of the user.
 * @property {string | null} name - The name of the user.
 * @property {string} avatar_url - The avatar URL of the user.
 * @property {string} html_url - The HTML URL of the user.
 * @property {string | null} bio - The bio of the user.
 * @property {string | null} location - The location of the user.
 * @property {number} followers - The number of followers of the user.
 * @property {number} following - The number of following of the user.
 * @property {number} public_repos - The number of public repositories of the user.
 */
export type Profile = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  followers: number;
  following: number;
  public_repos: number;
};

/**
 * Repo type for storing the repository of the user.
 * @property {string} name - The name of the repository.
 * @property {string} html_url - The HTML URL of the repository.
 * @property {string | null} description - The description of the repository.
 * @property {string | null} language - The language of the repository.
 * @property {number} stargazers_count - The number of stargazers of the repository.
 * @property {number} forks_count - The number of forks of the repository.
 * @property {string} updated_at - The updated at of the repository.
 */
export type Repo = {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
};

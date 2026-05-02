export interface ContactSubmission {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  sessionType?: string;
  message: string;
  createdAt: string;
}

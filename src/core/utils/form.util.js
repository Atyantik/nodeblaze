import Busboy from "busboy";
import { requestMemoize } from "./memoize.util.js";

export const getFormData = requestMemoize((request) => {
  return new Promise((resolve) => {
    if (['GET', 'HEAD'].includes(request.method)) {  
      return resolve(new FormData());
    }
    const headers = new Headers(request.headers);
    if(!headers.get('content-type').includes('multipart')) {
      return resolve(new FormData());
    }
    const form = new FormData();
    const busboy = Busboy({ headers: request.headers });

    busboy.on("file", (fieldname, file, { filename, mimeType }) => {
      const chunks = [];
      file.on("data", (data) => {
        chunks.push(data);
      });
      file.on("end", () => {
        const fileBuffer = Buffer.concat(chunks);
        const blob = new Blob([fileBuffer], { type: mimeType });
        form.append(fieldname, blob, filename);
      });
    });

    busboy.on("field", (fieldname, val) => {
      form.append(fieldname, val);
    });

    busboy.on("finish", () => {
      // Now you can use the form data as needed
      resolve(form);
    });
    request.pipe(busboy);
  });
});

// The user explicitly requests a clipboard copy and a launch of the original UI.
// Neither this operation nor the launcher submits text to a provider.
export async function copyAndOpen({ content, copy, launch, record }) {
  await copy(content);
  let recordError;
  try {
    await record();
  } catch (error) {
    recordError = error.message;
  }
  try {
    await launch();
    return { copied: true, started: true, recordError };
  } catch (error) {
    return { copied: true, started: false, error: error.message, recordError };
  }
}

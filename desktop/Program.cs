using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    private static readonly Uri Home = new("http://127.0.0.1:3000/lifemap");

    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var checkOnly = args.Contains("--check");
        var outcome = checkOnly ? 1 : 0;
        using var window = new Form
        {
            Text = "Lifemap",
            Size = new Size(1280, 850),
            WindowState = checkOnly ? FormWindowState.Normal : FormWindowState.Maximized,
            MinimumSize = new Size(700, 480),
            StartPosition = FormStartPosition.CenterScreen,
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath),
            ShowInTaskbar = !checkOnly,
            Opacity = checkOnly ? 0 : 1,
        };
        var paper = Color.FromArgb(243, 246, 242);
        window.BackColor = paper;
        using var startup = new TableLayoutPanel
        {
            BackColor = paper, Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3,
        };
        startup.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
        startup.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        startup.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
        using var message = new Label
        {
            Text = "LifeMap wird geöffnet …", AutoSize = true, Anchor = AnchorStyles.None,
            ForeColor = Color.FromArgb(35, 61, 49), Padding = new Padding(12),
        };
        using var retry = new Button
        {
            Text = "Erneut versuchen", AutoSize = true, Anchor = AnchorStyles.Top, Visible = false,
        };
        startup.Controls.Add(message, 0, 1);
        startup.Controls.Add(retry, 0, 2);
        window.Controls.Add(startup);

        WebView2? view = null;
        using var navigationTimer = new System.Windows.Forms.Timer { Interval = 30000 };

        void ShowFailure(string reason)
        {
            navigationTimer.Stop();
            if (window.IsDisposed) return;
            if (checkOnly) { window.Close(); return; }
            if (view != null) view.Visible = false;
            message.Text = reason;
            startup.Visible = true;
            startup.BringToFront();
            retry.Visible = true;
        }

        async Task OpenAsync()
        {
            retry.Visible = false;
            message.Text = "LifeMap wird geöffnet …";
            startup.Visible = true;
            view?.Dispose();
            view = null;
            try
            {
                var project = FindProject();
                await EnsureServerAsync(project);
                if (window.IsDisposed) return;

                var browser = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = paper, Visible = false };
                view = browser;
                window.Controls.Add(browser);
                startup.BringToFront();
                var profile = Path.Combine(project, "data", "desktop", "webview");
                var options = new CoreWebView2EnvironmentOptions { AreBrowserExtensionsEnabled = false };
                var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile, options: options)
                    .WaitAsync(TimeSpan.FromSeconds(30));
                if (window.IsDisposed) return;
                await browser.EnsureCoreWebView2Async(environment).WaitAsync(TimeSpan.FromSeconds(30));
                if (window.IsDisposed) return;

                var core = browser.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.NavigationStarting += (_, e) =>
                {
                    if (IsLocal(e.Uri)) return;
                    e.Cancel = true;
                    if (e.IsUserInitiated) OpenLink(e.Uri);
                };
                core.NewWindowRequested += (_, e) =>
                {
                    e.Handled = true;
                    if (e.IsUserInitiated) OpenLink(e.Uri);
                };
                core.ProcessFailed += (_, e) =>
                {
                    if (e.ProcessFailedKind is CoreWebView2ProcessFailedKind.BrowserProcessExited or
                        CoreWebView2ProcessFailedKind.RenderProcessExited)
                        ShowFailure("Die Anzeige von LifeMap wurde unterbrochen.");
                };
                core.NavigationCompleted += (_, e) =>
                {
                    if (!e.IsSuccess && e.WebErrorStatus == CoreWebView2WebErrorStatus.OperationCanceled) return;
                    navigationTimer.Stop();
                    if (checkOnly)
                    {
                        outcome = e.IsSuccess && core.DocumentTitle.StartsWith("Lifemap", StringComparison.Ordinal) ? 0 : 1;
                        window.Close();
                    }
                    else if (e.IsSuccess)
                    {
                        browser.Visible = true;
                        startup.Visible = false;
                    }
                    else
                    {
                        ShowFailure("Der Kalender konnte nicht geladen werden.");
                    }
                };
                navigationTimer.Start();
                core.Navigate(Home.AbsoluteUri);
            }
            catch (Exception e)
            {
                ShowFailure(e is TimeoutException
                    ? "LifeMap hat beim Start zu lange gebraucht."
                    : e.Message);
            }
        }

        navigationTimer.Tick += (_, _) => ShowFailure("Der Kalender hat beim Laden zu lange gebraucht.");
        retry.Click += async (_, _) => await OpenAsync();
        window.Shown += async (_, _) => await OpenAsync();
        Application.Run(window);
        return outcome;
    }

    private static string FindProject()
    {
        for (var folder = new DirectoryInfo(AppContext.BaseDirectory); folder != null; folder = folder.Parent)
        {
            if (File.Exists(Path.Combine(folder.FullName, "Start-Lifemap.ps1"))) return folder.FullName;
        }
        throw new InvalidOperationException("Die Startdatei von LifeMap fehlt.");
    }

    private static async Task EnsureServerAsync(string project)
    {
        var powershell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
        var start = new ProcessStartInfo(powershell)
        {
            WorkingDirectory = project,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
        };
        foreach (var argument in new[] { "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
            Path.Combine(project, "Start-Lifemap.ps1"), "-CheckOnly" })
            start.ArgumentList.Add(argument);

        using var process = Process.Start(start) ?? throw new InvalidOperationException("LifeMap konnte nicht gestartet werden.");
        var errorTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        var error = await errorTask;
        if (process.ExitCode == 0) return;

        var reason = error.Split('\n').FirstOrDefault(line => !string.IsNullOrWhiteSpace(line))?.Trim();
        throw new InvalidOperationException(reason ?? "Der lokale LifeMap-Dienst konnte nicht gestartet werden.");
    }

    private static bool IsLocal(string address) =>
        Uri.TryCreate(address, UriKind.Absolute, out var uri) &&
        uri.Scheme == Home.Scheme && uri.Host == Home.Host && uri.Port == Home.Port;

    private static void OpenLink(string address)
    {
        if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch (Exception) { MessageBox.Show("Der Link konnte nicht geöffnet werden.", "Lifemap"); }
    }
}
